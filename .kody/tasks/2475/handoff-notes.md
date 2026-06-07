## Fix: CI Build Failure on PR #2475 — `_webpack.WebpackError is not a constructor`

### Root Cause
The previous task 2475 attempt changed the webpack callback from `!isClient` to `webpackConfig.name !== 'client'`. However, `isClient` is always `undefined` in Next.js 15.5.9's webpack callback (only `isServer` is passed). The `.node$` alias (pointing to `empty-stub.js`) and `resolve.fallback.node: false` were being applied to ALL builds including the client build. These settings caused the minify-webpack-plugin to fail when it tried to report an error during minification — `_webpack.WebpackError` is not exported from Next.js 15.5.9's bundled webpack.

### Fix Applied
1. **Removed** the `\\.node$` resolve.alias and `resolve.fallback.node: false` settings — these were unnecessary (undici and @napi-rs/canvas are in `serverExternalPackages`) and were causing the minify-webpack-plugin error.

2. **Removed** the unused `path` import and `src/server/utils/empty-stub.js` file.

3. **Kept** undici and @napi-rs/canvas in `webpackConfig.externals` using `!isClient` (always `true` since `isClient` is `undefined`). This ensures webpack never analyzes undici's code in any build. Safe because `serverExternalPackages` prevents them from entering the client bundle in the first place.

### Files Changed
- `next.config.js` — removed `.node$` alias, `resolve.fallback.node: false`, `path` import; simplified externals
- `src/server/utils/empty-stub.js` — deleted (no longer needed)

### Key Insight
In Next.js 15.5.9 webpack callback, `isClient` is always `undefined`. The `.node$` alias and `resolve.fallback.node: false` were the actual cause of the CI failure — not the `!isClient` condition. Both undici and @napi-rs/canvas are already in `serverExternalPackages`, so the `.node$` alias was redundant. The `resolve.fallback.node: false` does not intercept `node:` protocol imports (they bypass `resolve.fallback`), so it provided no benefit but caused minification to fail.

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 2
