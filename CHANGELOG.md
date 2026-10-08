# Changelog

All notable changes to SystemPro are documented in this file. The project follows semantic versioning for public releases.

## Unreleased

### Fixed

- Prevent outdated meter and metering queries from overwriting newer results or hiding their loading state.
- Prevent in-flight authentication refreshes and old-session responses from restoring a logged-out session or clearing a newer login.
- Reuse refreshed tokens for delayed 401 responses and retain refresh tokens during temporary service outages.
- Add configurable request timeouts and cancellation, a separate export timeout, and clearer gateway-error messages.

- Preserve the final event when an AI SSE stream closes without a trailing blank line.
- Retry file exports after refreshing an expired authentication session.
- Keep the draggable AI assistant trigger and panel inside the viewport after resizing.

### Added

- Executable request, session, and page-loading regression checks (`npm run test:reliability`), also run in CI.

## 0.1.0 - 2026-08-27

### Added

- Initial public Vue 3 administration console for IoT and energy operations.
- Read-only demo mode and runtime API endpoint configuration.
- Device, energy, HVAC, alarm, work-order, billing, permission, and AI assistant interfaces.
- English and Simplified Chinese documentation.
