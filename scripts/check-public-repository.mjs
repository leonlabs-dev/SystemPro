import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowedEnv = new Set(['.env.example']);
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules']);
const ignoredFiles = new Set(['README.md', 'README.zh-CN.md', 'package-lock.json', 'check-public-repository.mjs']);
const publicRuntimeConfig = 'public/app-config.js';
const forbiddenPrivateImplementationPaths = [
  'src/domain/finance/finance.api.ts',
  'src/domain/iot/alarm-work-order/api/alarm-operations.api.ts',
  'src/pages/finance/FinanceWorkspace.vue',
];
const sharedDemoPasswordPattern = new RegExp(`\\b${['1234', '5678'].join('')}\\b`);
const textExtensions = new Set([
  '.css', '.env', '.example', '.html', '.js', '.json', '.md', '.mjs', '.scss', '.ts', '.tsx', '.vue', '.yaml', '.yml',
]);
const secretExtensions = new Set(['.key', '.p12', '.pfx', '.pem']);

const forbiddenPatterns = [
  { label: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { label: 'embedded environment password', pattern: /(?:SYSTEMPRO_DB_PASSWORD|DATABASE_PASSWORD|VITE_[A-Z0-9_]*SECRET)\s*=\s*\S+/i },
  { label: 'shared default password outside the declared public demo config', pattern: sharedDemoPasswordPattern, allowedIn: new Set([publicRuntimeConfig]) },
  { label: 'embedded access token', pattern: /(?:access[_-]?token|api[_-]?key|client[_-]?secret)\s*[:=]\s*["'][^"'\s]{8,}["']/i },
  { label: 'SystemPro hosted API address outside the declared public runtime config', pattern: /https?:\/\/(?:console\.)?systempro\.site/i, allowedIn: new Set([publicRuntimeConfig]) },
  { label: 'internal workspace path', pattern: /[A-Z]:\\AstraOS\\/i },
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const failures = [];
const files = walk(root);

for (const relative of forbiddenPrivateImplementationPaths) {
  if (fs.existsSync(path.join(root, relative))) {
    failures.push(`${relative}: private-edition implementation must not be published`);
  }
}

for (const file of files) {
  const relative = path.relative(root, file).split('\\').join('/');
  const basename = path.basename(file);
  const extension = path.extname(file).toLowerCase();

  if (secretExtensions.has(extension)) failures.push(`${relative}: secret-bearing file type is not public`);
  if (basename.startsWith('.env') && !allowedEnv.has(basename)) failures.push(`${relative}: only .env.example may be committed`);
  if (ignoredFiles.has(basename) || !textExtensions.has(extension)) continue;

  const content = fs.readFileSync(file, 'utf8');
  for (const rule of forbiddenPatterns) {
    if (rule.allowedIn?.has(relative)) continue;
    if (rule.pattern.test(content)) failures.push(`${relative}: ${rule.label}`);
  }
}

const envExamplePath = path.join(root, '.env.example');
if (!fs.existsSync(envExamplePath)) {
  failures.push('.env.example: required public configuration template is missing');
} else {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  if (!/^VITE_APP_MODE=api$/m.test(envExample)) failures.push('.env.example: API mode must match the public runtime default');
  if (!/^VITE_API_BASE_URL=$/m.test(envExample)) failures.push('.env.example: API base URL must be blank');
  if (!/^VITE_DEV_API_TARGET=$/m.test(envExample)) failures.push('.env.example: development API target must be blank');
}

const publicRuntimeConfigPath = path.join(root, publicRuntimeConfig);
if (!fs.existsSync(publicRuntimeConfigPath)) {
  failures.push(`${publicRuntimeConfig}: required single public runtime configuration entry is missing`);
} else {
  const runtimeConfig = fs.readFileSync(publicRuntimeConfigPath, 'utf8');
  if (!/must never contain a secret/i.test(runtimeConfig)) failures.push(`${publicRuntimeConfig}: public-data warning is missing`);
  if (!/appMode:\s*['"]api['"]/.test(runtimeConfig)) failures.push(`${publicRuntimeConfig}: hosted API mode must be the default`);
  if (!/apiBaseUrl:\s*['"]https:\/\//.test(runtimeConfig)) failures.push(`${publicRuntimeConfig}: a HTTPS API origin is required`);
  if (!/publicDemoAccount:\s*\{[\s\S]*?enabled:\s*true/.test(runtimeConfig)) failures.push(`${publicRuntimeConfig}: public demo account must be explicitly enabled`);
}

const indexPath = path.join(root, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const runtimeIndex = indexHtml.indexOf('app-config.js');
  const moduleIndex = indexHtml.indexOf('type="module"');
  if (runtimeIndex < 0) failures.push('index.html: public runtime configuration script is missing');
  if (moduleIndex < 0) failures.push('index.html: application module entry is missing');
  if (runtimeIndex >= moduleIndex) failures.push('index.html: public runtime configuration must load before the application module');
}

if (failures.length) {
  console.error('Public repository safety check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Public repository safety check passed.');
