# Fix CI failures for dev branch (task 2266)

## What was fixed

1. **kody.config.json Prettier formatting** - The Fast Gate was failing because `kody.config.json` had arrays spread across multiple lines instead of being condensed. Ran `pnpm format` to fix.

2. **src/payload-types.ts stale** - The typecheck was failing because `src/payload-types.ts` was out of sync with the Payload schema (missing `payload-mcp-api-keys` collection). Ran `pnpm generate:types` to regenerate.

## What was NOT fixed

- **audit job (26742689013)** - Fails because DATABASE_URL env var is not set in the audit CI job environment. This is a CI configuration issue, not a code defect.
- **atlas-tests and CodeQL** - Could not retrieve failure details from GitHub API (auth/rate limit issue).

## Verification

All quality gates now pass: `pnpm ci:local` succeeds (typecheck, lint, format, tests).
