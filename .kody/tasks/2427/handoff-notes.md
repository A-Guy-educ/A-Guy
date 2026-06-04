## Fix: Dev server now starts without live environment variables

### Root cause
`payload.config.ts` and its plugins perform import-time validation of required env vars (`DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`). These threw before `pnpm dev` could even reach the Next.js boot phase. Type generation (`payload generate:types`) was also blocked.

### Changes

**src/payload.config.ts**
- DATABASE_URL guard: added `isGeneratingTypesOrImportMap` check (skips if `PAYLOAD_GENERATE_TYPES=true` or `PAYLOAD_GENERATE_IMPORTMAP=true`)
- PAYLOAD_SECRET guard: same bypass with placeholder value `'placeholder-secret-for-type-generation-only'`

**src/server/payload/plugins/index.ts**
- BLOB_READ_WRITE_TOKEN guard: extended existing `PAYLOAD_GENERATE_TYPES` guard to also cover `PAYLOAD_GENERATE_IMPORTMAP`

**package.json**
- `generate:importmap` script now sets `PAYLOAD_GENERATE_IMPORTMAP=true`

### Why this works
`PAYLOAD_GENERATE_TYPES` and `PAYLOAD_GENERATE_IMPORTMAP` are set by the npm scripts themselves, not by the user. The guards now only fire during actual runtime (Next.js dev server boot), where the real env vars are needed.
