## Fix: CI Build Failure on PR #2475

### Root Cause
The CI build was failing with `UnhandledSchemeError: Reading from "node:console/node:crypto/node:dns/diagnostics_channel"` and `Error: Node.js binary module ... skia.linux-x64-gnu.node is not supported in the browser`.

These errors occur because webpack analyzes `payload.config.ts` (imported by middleware) and traces through:
1. `payload` → `safeFetch.js` (uses `undici`) → undici's internal `node:` imports (node:dns, node:console, etc.) → `UnhandledSchemeError`
2. `pdf-render-service.ts` → `@napi-rs/canvas` → `.node` binary files → browser binary error

The previous fix (commit 4f6d4b0ac) removed the webpack externals and `.node$` alias, relying on `serverExternalPackages` alone. But `serverExternalPackages` only prevents bundling into the serverless function — it does NOT prevent webpack from analyzing the source when the package is imported via `payload.config.ts` which is loaded by middleware (part of the client bundle analysis).

### Fix Applied
Restored the webpack callback configuration from commit `4930aa79b`:
1. Changed callback from `(webpackConfig)` back to `(webpackConfig, { isClient })`
2. Added `path` import (needed for stub path resolution)
3. Added `if (!isClient)` externals block for `undici` and `@napi-rs/canvas`
4. Added `.node$` alias to `empty-stub.js`
5. Added `resolve.fallback.node: false`

### Why This Works
- **Externals**: When `undici` and `@napi-rs/canvas` are in `webpackConfig.externals` for non-client builds, webpack treats them as Node.js native modules and does NOT analyze their internal source code. The `node:` imports inside undici are never encountered.
- **`.node$` alias**: Redirects `.node` binary files to `empty-stub.js`, preventing the browser binary error.
- **`resolve.fallback.node: false`**: Prevents webpack from providing Node.js polyfills; combined with externals, this is correct for server builds.

### Files Changed
- `next.config.js` — restored webpack callback with isClient parameter, externals, .node$ alias, and resolve.fallback.node: false

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
