## Fix: CI Build Failure — UnhandledSchemeError for node: URL scheme imports

### Root Cause

Two fixes applied separately in prior sessions were each incomplete:

1. **session 2475 (first fix)**: Removed the `resolve.scheme` webpack plugin hook (incompatible with webpack 5.98.0), relying on `webpackConfig.externals` for `get-tsconfig`. But other packages (`payload` via its telemetry, `node-fetch` via `@genkit-ai/googleai`) still had their internals analyzed.

2. **session 2476 (second fix)**: Added `resolve.alias` entries for `node:console`, `node:crypto`, `node:dns`, `node:diagnostics_channel` but ALSO removed `externals` for undici. Webpack then analyzed undici's mock utilities which contain `require('node:dns')` and `require('node:diagnostics_channel')`, causing `UnhandledSchemeError`.

The root cause: **`node-fetch` was in `serverExternalPackages` but NOT in `webpackConfig.externals`**. `serverExternalPackages` prevents Next.js from including a package in the serverless bundle, but webpack still analyzes the package's source for tree-shaking. `webpackConfig.externals` is what tells webpack to skip analysis entirely. `node-fetch` was pulled into the build by `@genkit-ai/googleai` (import chain: `payload.config.ts` → `import-from-image.ts` → `data-extractor-service.ts` → `unified-adapter.ts` → `@genkit-ai/googleai` → `node-fetch`).

### Fix Applied

1. Added `node-fetch` to `webpackConfig.externals` for non-client builds — webpack never analyzes its internals, so the `node:http`, `node:https`, `node:net`, `node:dns` imports inside it are never encountered.

2. Added comprehensive `resolve.alias` entries for all known `node:` protocol modules (`node:fs`, `node:https`, `node:http`, `node:net`, `node:os`, `node:dns`, `node:module`, `node:diagnostics_channel`, `node:console`, `node:crypto`) plus `\\.node$` for native binaries. All redirect to `src/server/utils/empty-stub.js`. This is defense-in-depth: packages in `externals` are never analyzed, but any remaining code that webpack does analyze (e.g., payload's telemetry) gets stubbed instead of throwing.

### Files Changed

- `next.config.js` — added `node-fetch` to webpackConfig.externals; added comprehensive `node:` protocol `resolve.alias` entries; removed redundant old stub block.

### Why Both externals AND resolve.alias Are Needed

- **`webpackConfig.externals`**: tells webpack "never analyze this package's source code" — prevents the problem at the source
- **`resolve.alias`**: stubs any `node:` imports that webpack does encounter during analysis of non-external packages — catches stray references

### Verification

- `mcp__kody-verify__verify` — ok: true, attempt 1
