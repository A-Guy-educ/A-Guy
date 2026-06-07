## Fix: CI Build Failure on PR #2475

### Root Cause
Every CI-fix attempt on this branch (40+ commits) failed because none of them reverted the webpack callback to match `dev`. The webpack callback had `webpackConfig.externals = [...(webpackConfig.externals || []), 'undici', '@napi-rs/canvas']` added, which has no counterpart in `dev` and was never needed (undici and @napi-rs/canvas are already in `serverExternalPackages`). This addition, combined with the earlier `.node$` alias and `resolve.fallback.node: false` attempts, created a cascade of webpack misconfigurations that all failed with `_webpack.WebpackError is not a constructor`.

### Fix Applied
Reverted the webpack callback to match `dev` exactly — removed the unconditional `webpackConfig.externals` addition. The dev webpack config (just `extensionAlias` and markdown loader) was always the correct configuration. The login form fixes (middleware hasAuthToken async, loginAction token handling) are unrelated to webpack and remain intact.

### Files Changed
- `next.config.js` — removed `webpackConfig.externals` addition from webpack callback

### Why This Works
The `dev` branch builds successfully because undici and @napi-rs/canvas are already in `serverExternalPackages`, which tells Next.js not to bundle them for the client. No webpack-level externals configuration is needed. Adding `webpackConfig.externals` was a misguided fix that never worked and introduced conflicts in the webpack build.

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 3
