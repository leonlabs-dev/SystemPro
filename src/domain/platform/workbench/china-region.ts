const REGION_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['北京', ['Beijing']],
  ['天津', ['Tianjin']],
  ['上海', ['Shanghai']],
  ['重庆', ['Chongqing']],
  ['河北', ['Hebei']],
  ['山西', ['Shanxi']],
  ['辽宁', ['Liaoning']],
  ['吉林', ['Jilin']],
  ['黑龙江', ['Heilongjiang']],
  ['江苏', ['Jiangsu']],
  ['浙江', ['Zhejiang']],
  ['安徽', ['Anhui']],
  ['福建', ['Fujian']],
  ['江西', ['Jiangxi']],
  ['山东', ['Shandong']],
  ['河南', ['Henan']],
  ['湖北', ['Hubei']],
  ['湖南', ['Hunan']],
  ['广东', ['Guangdong']],
  ['海南', ['Hainan']],
  ['四川', ['Sichuan']],
  ['贵州', ['Guizhou']],
  ['云南', ['Yunnan']],
  ['陕西', ['Shaanxi']],
  ['甘肃', ['Gansu']],
  ['青海', ['Qinghai']],
  ['台湾', ['Taiwan']],
  ['内蒙古', ['Inner Mongolia']],
  ['广西', ['Guangxi']],
  ['西藏', ['Tibet', 'Xizang']],
  ['宁夏', ['Ningxia']],
  ['新疆', ['Xinjiang']],
  ['香港', ['Hong Kong', 'Hong Kong SAR', 'Hong Kong S.A.R.', 'Hong Kong SAR China', 'HKSAR', '中国香港']],
  ['澳门', ['Macao', 'Macau']],
];

const UNKNOWN_REGION_KEYS = new Set(['', 'unknown', '未知', '本机', '内网', 'local']);

function regionKey(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/special administrative region|autonomous region|autonomous prefecture|municipality|province/g, '')
    .replace(/\b(uyghur|uygur|zhuang|hui|sar)\b/g, '')
    .replace(/壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市/g, '')
    .replace(/[\s._-]+/g, '');
}

const CANONICAL_REGION_BY_KEY = new Map<string, string>();
for (const [canonicalName, aliases] of REGION_ALIASES) {
  CANONICAL_REGION_BY_KEY.set(regionKey(canonicalName), canonicalName);
  for (const alias of aliases) CANONICAL_REGION_BY_KEY.set(regionKey(alias), canonicalName);
}

export function isUnknownLoginRegion(value?: string | null) {
  return value == null || UNKNOWN_REGION_KEYS.has(regionKey(value));
}

/** Returns the exact Chinese name used by china-geojson, or null when unsupported. */
export function normalizeChinaRegionName(value?: string | null) {
  if (isUnknownLoginRegion(value)) return null;
  return CANONICAL_REGION_BY_KEY.get(regionKey(value!)) ?? null;
}

export function displayLoginRegionName(value: string, useChinese: boolean) {
  if (!useChinese) return value;
  return normalizeChinaRegionName(value) ?? value;
}
