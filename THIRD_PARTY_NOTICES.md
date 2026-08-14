# Third-Party Notices

This inventory covers direct runtime and build dependencies declared in `package.json`. Transitive dependency notices remain available in the installed npm packages and should be regenerated for each release.

| Package | License | Project |
| --- | --- | --- |
| `@element-plus/icons-vue` | MIT | https://github.com/element-plus/element-plus-icons |
| `china-geojson` | MIT (package manifest) | https://github.com/antvis/china-geojson |
| `echarts` | Apache-2.0 | https://github.com/apache/echarts |
| `element-plus` | MIT | https://github.com/element-plus/element-plus |
| `pinia` | MIT | https://github.com/vuejs/pinia |
| `simple-icons` | CC0-1.0; trademarks may apply | https://github.com/simple-icons/simple-icons |
| `vue` | MIT | https://github.com/vuejs/core |
| `vue-i18n` | MIT | https://github.com/intlify/vue-i18n |
| `vue-router` | MIT | https://github.com/vuejs/router |
| `typescript` | Apache-2.0 | https://github.com/microsoft/TypeScript |
| `vite` | MIT | https://github.com/vitejs/vite |

The `china-geojson` package manifest declares MIT licensing but its npm tarball does not include a separate license file. Keep this item under release review if the package version changes.

An installed-tree audit of the current lockfile found 130 package manifests: 116 MIT, 6 ISC, 4 BSD-3-Clause, 2 Apache-2.0, 1 CC0-1.0, and 1 0BSD. No installed package was missing a license field, and no GPL/AGPL-family license was found.

The repository's own open-source license is intentionally pending and must be added before public distribution.
