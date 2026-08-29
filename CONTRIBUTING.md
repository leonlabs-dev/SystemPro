# Contributing to SystemPro

Thank you for helping improve SystemPro. This repository contains the public Vue 3 frontend console for IoT and energy operations.

## Before You Start

- Use an Issue to report a reproducible bug or propose a meaningful feature.
- Do not include production credentials, personal data, customer data, or private API responses.
- Keep changes focused. Avoid mixing formatting-only changes with functional changes.
- Preserve the public-edition boundary: production backend code, database schemas, and secrets do not belong in this repository.

## Local Development

Requirements: Node.js 18 or later and npm.

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run build
npm run test:ui-contracts
```

The build command also runs repository safety checks, theme contracts, TypeScript validation, and the performance budget.

## Pull Requests

1. Explain the problem and the user-visible result.
2. Link the related Issue when one exists.
3. Include screenshots for UI changes.
4. Describe how the change was verified.
5. Keep public APIs and runtime configuration backward-compatible when practical.

Recommended commit prefixes include `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, and `chore:`.

## Security Issues

Do not disclose vulnerabilities in a public Issue. Follow [SECURITY.md](./SECURITY.md) instead.
