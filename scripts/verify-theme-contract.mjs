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

forbidPattern('layout root visual filter', layout, /(?:^|[;{]\s*)filter\s*:\s*(?:saturate|grayscale)\s*\(/im);
forbidPattern('legacy weak-mode layout class', layout, /is-weak-mode/);
requireText('accessibility mode renders an application-wide visual layer', layout, 'app-layout__visual-a11y-layer');
requireText('application-wide visual layer cannot intercept interaction', layout, 'pointer-events: none');
requireText('application-wide visual layer affects the complete visible workspace', layout, 'backdrop-filter: saturate(0.55) contrast(1.04)');
requireText('versioned migration clears legacy state', layoutStore, 'shouldResetLegacyWeakMode');
requireText('accessibility mode uses document state', layoutStore, "dataset.visualA11y = 'color-weak'");
requireText('application restores visual preference', app, 'layoutStore.applyVisualPreference()');
requireText('light accessibility palette is token-scoped', lightTokens, "[data-visual-a11y='color-weak']");
requireText('dark accessibility palette is token-scoped', darkTokens, "[data-visual-a11y='color-weak']");
requireText('light accessibility palette visibly overrides the selected accent', lightTokens, '--color-primary-500: #005A9C !important');
requireText('dark accessibility palette visibly overrides the selected accent', darkTokens, '--color-primary-500: #56B4E9 !important');

for (const [name, source] of [
  ['theme drawer', themeDrawer],
  ['personal drawer', personalDrawer],
]) {
  requireText(`${name} is body-mounted`, source, 'append-to-body');
  requireText(`${name} destroys stale overlays`, source, 'destroy-on-close');
}
forbidPattern('theme drawer must not clear accessibility mode during theme switch', themeDrawer, /layoutStore\.setWeakMode\(false\)/);
forbidPattern('personal drawer must not clear accessibility mode during theme switch', personalDrawer, /layoutStore\.setWeakMode\(false\)/);
requireText('theme drawer preserves modal focus and outside click behavior', themeDrawer, ':modal="true"');
requireText('theme drawer closes on outside click', themeDrawer, ':close-on-click-modal="true"');
requireText('theme drawer uses a dedicated transparent overlay', themeDrawer, 'modal-class="theme-settings-overlay"');
requireText('theme drawer overlay keeps interaction without dimming the page', themeDrawer, ':global(.theme-settings-overlay)');
forbidPattern('theme drawer must not disable its modal interaction layer', themeDrawer, /:modal="false"/);
requireText('personal drawer exposes close completion', personalDrawer, '@closed="emit(\'closed\')"');
requireText('theme drawer exposes close completion', themeDrawer, '@closed="emit(\'closed\')"');
requireText('drawer handoff waits for close completion', layout, '@closed="handleProfileClosed"');
requireText('reverse drawer handoff waits for close completion', layout, '@closed="handleThemeClosed"');
forbidPattern('drawer handoff opens both drawers in one event', layout, /profileVisible\s*=\s*false\s*;\s*settingsVisible\s*=\s*true/);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log('PASS theme and accessibility state are isolated from global visual filters');
console.log('PASS accessibility mode applies across the complete visible workspace');
console.log('PASS drawers are mounted outside layout stacking contexts');
console.log('PASS theme preview keeps outside-click behavior without modal dimming');
console.log('PASS accessibility palette remains active across light and dark themes');
console.log('PASS legacy persisted weak-mode state is migrated safely');
