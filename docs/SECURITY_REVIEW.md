# Security Review

The public-source scan runs as the first production-build step and rejects committed environment files, private keys, embedded tokens, credentials outside the declared public demo configuration, undeclared SystemPro service addresses, and internal workspace paths.

`public/app-config.js` is an explicit public-disclosure boundary. Its API origin and demonstration credentials are intentionally readable by every visitor and must never be treated as secrets. The corresponding backend account must be dedicated to an isolated demonstration Client, non-administrative, rate-limited, audited, free of customer data, and safe to revoke or reset. The frontend cannot provide these controls; the backend must enforce them.

## Dependency advisories

The current UI was copied from a compatibility-focused Node 14 frontend baseline. An npm production audit reports advisories in the following direct dependencies:

- `vue-i18n@9.2.2`: fixed releases require Node 16 or newer. The current application does not enable `flatJson` and does not render translated parameters as trusted HTML, which removes the known application paths, but the package must still be upgraded when the Node floor is raised.
- `echarts@5.4.3`: the published XSS advisory concerns untrusted names in a Lines-series built-in tooltip. The energy-flow page uses Lines series only with fixed source-code names, `silent: true`, and no user-controlled series name. Upgrade to ECharts 6 must still be handled as an explicit visual and performance compatibility project.
- `element-plus@2.4.4`: the advisory concerns passing untrusted protocols directly to `el-link`. Public project links are fixed configuration values; user-controlled URLs must never be sent directly to that component.

Patched `postcss` and `nanoid` versions are pinned at the workspace root to remove known build-chain path traversal and denial-of-service advisories while retaining Node 14 compatibility.

These mitigations are not a substitute for dependency maintenance. Before a public production deployment, rerun `npm audit --production`, review every remaining advisory against the actual code path, and schedule the Node 16+ and dependency-major upgrade as a separate tested change.
