## Fix: CI Build Failure — UnhandledSchemeError for node: URL scheme imports

### Root Cause
The previous CI fix (commit 6e366e2e1) attempted to intercept `node:` URL scheme imports from undici via `resolve.alias` entries in the client webpack config. However, `resolve.alias` cannot intercept `node:` URL schemes — they bypass `resolve.alias` and go through webpack's scheme handling mechanism (`resolveForScheme`), which had no handler for `node:` in the client build.

When `undici` was removed from `webpackConfig.externals` in the refactoring, webpack started analyzing undici's internal code for tree-shaking. It encountered `require('node:dns')` and `require('node:diagnostics_channel')` in undici's mock utilities, which caused `UnhandledSchemeError`.

### Fix Applied
Restored the original working approach from before the refactoring:

1. Added `undici` and `@napi-rs/canvas` back to `webpackConfig.externals` for non-client (server + Edge) builds
2. Applied `\\.node$` alias and `resolve.fallback.node: false` to all builds (for .node native binaries)
3. Removed the ineffective `node:console`, `node:crypto`, `node:dns`, `node:diagnostics_channel` resolve.alias entries from the client build (they were never working and are unnecessary when externals prevents analysis)

### Files Changed
- `next.config.js` — restored `externals` for non-client builds, simplified alias/fallback config

### Why externals works
When a package is in `webpackConfig.externals`, webpack treats it as a Node.js native module and never analyzes its internal source code. The `node:` imports inside undici are never encountered, avoiding `UnhandledSchemeError` entirely. This is the correct approach for server-only packages.

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
