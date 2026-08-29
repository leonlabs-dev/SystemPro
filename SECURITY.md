# Security Policy

## Supported Version

Security fixes are applied to the latest code on the `main` branch and to the latest published release when a release is available.

## Reporting a Vulnerability

Please do not publish credentials, personal information, customer data, exploit details, or private deployment information in a public Issue.

Use GitHub's private vulnerability reporting or a private security advisory when that option is available. If it is unavailable, open a public Issue containing only a short, non-sensitive request for a private reporting channel.

Include the affected version, impact, reproduction conditions, and a minimal proof of concept without real customer data. The maintainer will acknowledge a valid report and coordinate remediation and disclosure.

## Deployment Responsibilities

- Keep model keys, database passwords, signing keys, and tokens on the server.
- Treat frontend configuration and browser storage as public.
- Enforce authentication, tenant/project scope, and write permissions in the backend.
- Use supported dependencies and review security advisories before production deployment.
