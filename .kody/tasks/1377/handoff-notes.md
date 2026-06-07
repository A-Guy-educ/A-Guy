# Handoff Notes: Testing Patterns for Route Handlers

## What Was Done

Created `docs/specs/TESTING-PATTERNS.md` — a comprehensive guide documenting the established testing patterns for route handler integration tests in this codebase.

## Key Patterns Documented

1. **MongoDB Testcontainers** — Use `startMongoContainer`/`stopMongoContainer` for isolated test DB
2. **Dynamic Route Imports** — Import routes inside `beforeAll` after testcontainer setup to avoid `@payload-config` caching the wrong DATABASE_URL
3. **Admin User Creation** — Two-step pattern (create→student, update→admin) due to `ensureRoleOnSignup` hook
4. **Conditional Test Execution** — `describe.skipIf()` for tests requiring external tokens
5. **Vitest Environment** — Node environment required for JWT operations (jose library)
6. **Tenant Isolation** — Always include `tenantId` on tenant-scoped collections
7. **Error Response Testing** — Test both success (2xx) and error (4xx/5xx) paths

## Follow-ups

- Add link to `docs/specs/TESTING-PATTERNS.md` in `docs/_sidebar.md` under Specs section

## Branch Status

Branch `docs/testing-patterns-for-route-handlers` — ready for PR once sidebar link is added.
