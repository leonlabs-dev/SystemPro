# Data Boundaries

The UI always distinguishes the origin of data.

| Runtime mode | Source | Meaning | Write operations |
| --- | --- | --- | --- |
| `demo` | Browser-local deterministic providers | Product walkthrough data only; not a production measurement or customer record | Disabled |
| `api` | The configured compatible backend | Backend-authorized business data within its Client/Tenant and RBAC scope | Controlled by backend permissions |

Demo values may describe devices, energy, alarms, finance, or audit-style scenarios. They exist only to demonstrate information architecture and interaction behavior. They must not be presented in reports, screenshots, or marketing copy as measured production results.

The checked-in API mode uses a deliberately public demonstration account. Its credentials and API origin are visible in `app-config.js` and browser traffic. This account must remain in a dedicated demonstration Client, carry no administrative permission, contain no customer or production data, and be protected by backend rate limiting and audit controls.

Changing frontend configuration never weakens isolation: Client/Tenant scope, RBAC, write authorization, and data ownership must be enforced by the backend for every request.
