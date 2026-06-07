## Fix: Stale payload-types.ts causing CI typecheck failure

### Root Cause
`src/payload-types.ts` was out of sync with `src/payload.config.ts`. When `@payloadcms/plugin-mcp` was added to the Payload config (introducing the `payload-mcp-api-keys` collection), the type definitions were not regenerated. The typecheck step in CI detected the stale file and failed.

### Fix Applied
Ran `pnpm generate:types` (with `PAYLOAD_SECRET=test-secret-for-ci`) to regenerate `src/payload-types.ts`. The new types include `PayloadMcpApiKey` and `PayloadMcpApiKeyAuthOperations` interfaces for the MCP plugin's API key collection.

### Files Changed
- `src/payload-types.ts` — regenerated to include `payload-mcp-api-keys` collection types

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 2

### Prevention
Consider a pre-commit hook that detects `payload.config.ts` changes and automatically runs `pnpm generate:types`, then stages the resulting type file.
