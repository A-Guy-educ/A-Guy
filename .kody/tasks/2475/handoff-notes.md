## Fix: CI Build Failure on PR #2475 (HookWebpackError from minify-webpack-plugin)

### Root Cause
The webpack config on the PR branch added `'@napi-rs/canvas'` as a string external in `webpackConfig.externals`. This caused minify-webpack-plugin (built into Next.js's webpack bundle) to throw `HookWebpackError: _webpack.WebpackError is not a constructor` during the minification phase.

Separately, `resolve.alias` with pattern `'^node:'` cannot actually intercept `node:` URL scheme imports — resolve.alias only handles module names, not URL schemes.

### Fix Applied (next.config.js)
1. **Removed `@napi-rs/canvas` from `webpackConfig.externals`** — this was the direct cause of the minify-webpack-plugin conflict. The package is already in `serverExternalPackages` so it doesn't need to be in webpack externals.

2. **Added `NormalModuleReplacementPlugin`** (from Next.js's bundled webpack) to intercept `node:` protocol imports for all non-client (server + Edge) builds. The plugin redirects `node:*` requests to the empty stub at `src/server/utils/empty-stub.js`. This was done via runtime `require` inside the callback:
   ```js
   const webpackBundled = require('next/dist/compiled/webpack/webpack.js')
   webpackBundled.init()
   const NMRP = webpackBundled.webpack.NormalModuleReplacementPlugin
   ```
   The key insight: webpack config callbacks run in Node.js at build time where `require` IS available, even though `next.config.js` uses ESM at the top level.

3. **Kept `undici` in externals** — undici is not in serverExternalPackages so it still needs webpack external handling.

### Verification
- `pnpm build` passes
- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm format:check` passes
