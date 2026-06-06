## Fix: CI Build Failure on PR #2475 (native .node binary not supported in browser)

### Root Cause
The previous fix attempt (commit 170318bf5) removed the `NodeSchemePlugin` block but inadvertently also removed the `\\.node$` alias and `resolve.fallback.node: false` that were part of the same webpack block. Without the `\\.node$` alias, webpack tries to load `@napi-rs/canvas`'s native `.node` binary (skia.linux-x64-gnu.node) in the browser build, causing: "Error: Node.js binary module ... is not supported in the browser."

### Fix Applied
Re-added only the `\\.node$` alias and `resolve.fallback.node: false` (not `NodeSchemePlugin`) to the client webpack config. The condition uses `webpackConfig.name === 'client'` to target client builds only. Also restored the `import path from 'path'` that was removed in commit 170318bf5.

### Files Changed
- `next.config.js` — added `path` import and client-build-only `\\.node$` alias + `resolve.fallback.node: false`

### Key Insight
- `NodeSchemePlugin` was correctly removed (it caused `tap` errors on `resolverFactory.hooks.resolve`)
- The `\\.node$` alias and `resolve.fallback.node` were NOT part of `NodeSchemePlugin` and should NOT have been removed
- They are still needed to prevent webpack from trying to load native addon binaries in browser builds
- `webpackConfig.name === 'client'` is the correct way to target only the client webpack compilation

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
