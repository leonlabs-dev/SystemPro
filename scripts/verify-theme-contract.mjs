import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const layout = read('src/layout/AppLayout.vue');
const layoutStore = read('src/core/layout/layout.store.ts');
const app = read('src/App.vue');
const themeDrawer = read('src/layout/ThemeSettingsDrawer.vue');
const personalDrawer = read('src/layout/PersonalSettingsDrawer.vue');
const lightTokens = read('src/design-system/tokens/light.css');
const darkTokens = read('src/design-system/tokens/dark.css');

const failures = [];
const requireText = (name, source, expected) => {
  if (!source.includes(expected)) failures.push(`${name}: missing ${expected}`);
};
const forbidPattern = (name, source, pattern) => {
  if (pattern.test(source)) failures.push(`${name}: forbidden ${pattern}`);
};

forbidPattern('layout root visual filter', layout, /filter\s*:\s*(?:saturate|grayscale)\s*\(/i);
forbidPattern('legacy weak-mode layout class', layout, /is-weak-mode/);
requireText('versioned migration clears legacy state', layoutStore, 'shouldResetLegacyWeakMode');
requireText('accessibility mode uses document state', layoutStore, "dataset.visualA11y = 'color-weak'");
requireText('application restores visual preference', app, 'layoutStore.applyVisualPreference()');
requireText('light accessibility palette is token-scoped', lightTokens, "[data-visual-a11y='color-weak']");
requireText('dark accessibility palette is token-scoped', darkTokens, "[data-visual-a11y='color-weak']");

for (const [name, source] of [
  ['theme drawer', themeDrawer],
  ['personal drawer', personalDrawer],
]) {
  requireText(`${name} is body-mounted`, source, 'append-to-body');
  requireText(`${name} destroys stale overlays`, source, 'destroy-on-close');
}
requireText('theme drawer clears accessibility mode before theme switch', themeDrawer, 'layoutStore.setWeakMode(false)');
requireText('personal drawer clears accessibility mode before theme switch', personalDrawer, 'layoutStore.setWeakMode(false)');

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log('PASS theme and accessibility state are isolated from global visual filters');
console.log('PASS drawers are mounted outside layout stacking contexts');
console.log('PASS legacy persisted weak-mode state is migrated safely');
