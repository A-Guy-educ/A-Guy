## Fix: CI Build Failure on PR #2475 — `_webpack.WebpackError is not a constructor`

### Root Cause
The webpack callback in `next.config.js` was changed from `webpack: (webpackConfig) =>` to `webpack: (webpackConfig, { isClient }) =>`. However, Next.js 15.5.9 does NOT pass `isClient` to the webpack callback — it only passes `isServer`. Destructuring `{ isClient }` from the second argument gives `undefined`, and `!undefined === true`.

This meant `if (!isClient)` was `true` for ALL webpack builds (client, server, and edge), so `undici` and `@napi-rs/canvas` were incorrectly added to `webpackConfig.externals` for the client build. When webpack tried to process the client bundle, it encountered the error (likely an unhandled resolution issue) and then failed to report it properly via `new _webpack.WebpackError(...)` in the minify-webpack-plugin.

### Fix Applied
Reverted to `webpack: (webpackConfig) =>` and changed the condition from `!isClient` to `webpackConfig.name !== 'client'`.

- `webpackConfig.name === 'client'` for browser bundle
- `webpackConfig.name === 'server'` for server bundle
- `webpackConfig.name === 'edge-server'` for Edge bundle

This correctly applies the `externals` entry only for server + Edge builds, while the `.node$` alias and `node: false` fallback are applied to all builds as intended.

### Files Changed
- `next.config.js` — removed `{ isClient }` parameter, restored `(webpackConfig)`, changed condition to `webpackConfig.name !== 'client'`

### Key Insight
Next.js 15.5.9 webpack callback second argument: `{ dir, dev, isServer, buildId, config, defaultLoaders, totalPages, webpack, nextRuntime }`. `isClient` does NOT exist — use `webpackConfig.name === 'client'` to identify the browser build.

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
