import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:');
const dist = join(root, 'dist');
const manifestPath = [
  join(dist, '.vite', 'manifest.json'),
  join(dist, 'manifest.json'),
].find((path) => existsSync(path));

const budget = {
  initialJsRaw: 600 * 1024,
  initialJsGzip: 190 * 1024,
  routeChunkRaw: 110 * 1024,
  routeChunkGzip: 40 * 1024,
  imageSingle: 350 * 1024,
  imageTotal: 3200 * 1024,
  chinaMapRaw: 370 * 1024,
  chinaMapGzip: 145 * 1024,
  echartsRaw: 780 * 1024,
  echartsGzip: 260 * 1024,
};

if (!manifestPath) {
  throw new Error('Performance budget requires a production build manifest. Run npm run build first.');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];
const rows = [];
const sizeCache = new Map();

function sizes(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  const bytes = readFileSync(join(dist, file));
  const result = { raw: bytes.byteLength, gzip: gzipSync(bytes, { level: 9 }).byteLength };
  sizeCache.set(file, result);
  return result;
}

function check(label, actual, limit, file = '') {
  rows.push({ label, actual, limit, file });
  if (actual > limit) failures.push(`${label}: ${format(actual)} > ${format(limit)}${file ? ` (${file})` : ''}`);
}

function collectStaticFiles(key, output = new Set()) {
  const item = manifest[key];
  if (!item || output.has(item.file)) return output;
  output.add(item.file);
  for (const dependency of item.imports || []) collectStaticFiles(dependency, output);
  return output;
}

const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
if (!entryKey) throw new Error('Unable to locate the Vite entry chunk in the build manifest.');
const initialFiles = [...collectStaticFiles(entryKey)].filter((file) => file.endsWith('.js'));
const initialSize = initialFiles.reduce((sum, file) => {
  const value = sizes(file);
  sum.raw += value.raw;
  sum.gzip += value.gzip;
  return sum;
}, { raw: 0, gzip: 0 });
check('Initial JavaScript (raw)', initialSize.raw, budget.initialJsRaw, initialFiles.join(', '));
check('Initial JavaScript (gzip)', initialSize.gzip, budget.initialJsGzip, initialFiles.join(', '));

for (const [key, item] of Object.entries(manifest)) {
  if (!item.isDynamicEntry || !item.file?.endsWith('.js') || !/src\/pages\//.test(key)) continue;
  const value = sizes(item.file);
  check('Route chunk (raw)', value.raw, budget.routeChunkRaw, item.file);
  check('Route chunk (gzip)', value.gzip, budget.routeChunkGzip, item.file);
}

const assetFiles = walk(join(dist, 'assets'));
const images = assetFiles.filter((file) => /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(file));
const imageSizes = images.map((file) => ({ file: relative(dist, file).split(sep).join('/'), bytes: statSync(file).size }));
const largestImage = imageSizes.sort((a, b) => b.bytes - a.bytes)[0];
const imageTotal = imageSizes.reduce((sum, item) => sum + item.bytes, 0);
if (largestImage) check('Largest image', largestImage.bytes, budget.imageSingle, largestImage.file);
check('All emitted images', imageTotal, budget.imageTotal, `${images.length} files`);

for (const [label, prefix, rawLimit, gzipLimit] of [
  ['China map chunk', 'assets/china-map-', budget.chinaMapRaw, budget.chinaMapGzip],
  ['ECharts chunk', 'assets/echarts-', budget.echartsRaw, budget.echartsGzip],
]) {
  const file = assetFiles.map((value) => relative(dist, value).split(sep).join('/')).find((value) => value.startsWith(prefix) && value.endsWith('.js'));
  if (!file) {
    failures.push(`${label}: expected chunk was not emitted`);
    continue;
  }
  const value = sizes(file);
  check(`${label} (raw)`, value.raw, rawLimit, file);
  check(`${label} (gzip)`, value.gzip, gzipLimit, file);
}

for (const row of rows.filter((item) => !item.label.startsWith('Route chunk'))) {
  console.log(`${row.actual <= row.limit ? 'PASS' : 'FAIL'} ${row.label}: ${format(row.actual)} / ${format(row.limit)}${row.file ? ` · ${row.file}` : ''}`);
}
const routeRows = rows.filter((item) => item.label.startsWith('Route chunk'));
console.log(`PASS Route chunks checked: ${routeRows.length / 2}`);

if (failures.length) {
  console.error('\nPerformance budget exceeded:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
