# Repository Contents

The following source and maintenance files belong in the public repository:

- `src/` and `public/`: application source and public runtime configuration.
- `scripts/`: build-time quality gates. They check public-source safety, theme contracts, loading-state contracts, and performance budgets. They are not routed pages and are not included in the browser bundle.
- `docs/`: public configuration, data-boundary, asset-license, security, and repository-operation notes.
- `THIRD_PARTY_NOTICES.md`: direct third-party dependency and asset notices.
- `.env.example`: non-secret build-time fallback template.

The following generated or local directories must not be committed:

- `node_modules/`: local dependency installation.
- `dist/`: generated production build output.
- `artifacts/`: local screenshots and verification artifacts.
- `.env.local` and other `.env.*` files except `.env.example`: machine-specific configuration.

The `scripts/` directory exists for maintainers and CI. It is not a customer-facing module and does not appear in the SystemPro navigation.
