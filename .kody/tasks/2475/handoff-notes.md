## Fix: CI Build Failure on PR #2475

### Root Cause
The CI build was failing with `HookWebpackError: _webpack.WebpackError is not a constructor` from the minify-webpack-plugin. This was caused by the webpack config additions in commit `4930aa79b`:
1. `.node$` alias to `empty-stub.js`
2. `resolve.fallback.node = false`
3. `webpackConfig.externals` for `undici` and `@napi-rs/canvas` (guarded with `!isClient`)

The `.node$` alias and `resolve.fallback.node` were explicitly removed in commit `b2ae8ce94` because they "broke minify". Re-adding them in `4930aa79b` caused the `WebpackError is not a constructor` error. The `isClient` guard (`!isClient`) is also unreliable in Next.js 15.5.9 — if `isClient` is `undefined`, `!isClient` is `true` which incorrectly adds externals to client builds.

### Fix Applied
Reverted the webpack config to match the dev branch:
1. Removed `path` import (no longer needed)
2. Changed callback from `(webpackConfig, { isClient })` to `(webpackConfig)`
3. Removed the `if (!isClient)` externals block
4. Removed the `.node$` alias, `resolve.fallback`, and stub path

The webpack callback now only contains the `extensionAlias` and markdown loader — matching dev exactly.

### Why This Works
The `.node$` alias and `resolve.fallback.node = false` were known to break minify (per `b2ae8ce94`). The `undici` and `@napi-rs/canvas` packages are already handled by `serverExternalPackages` in next.config.js (Next.js-level exclusion from serverless bundles). The webpack `externals` are unnecessary and were causing the build failure.

### Files Changed
- `next.config.js` — reverted webpack callback to dev state (no externals, no stub/alias/fallback)

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
