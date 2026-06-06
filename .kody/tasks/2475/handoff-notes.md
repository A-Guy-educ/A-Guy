## Fix: CI Build Failure on PR #2475 (tap undefined error)

### Root Cause
The webpack config on the PR branch used `NormalModuleReplacementPlugin` (via `require('next/dist/compiled/webpack/webpack.js')` + `init()`) to intercept `node:` protocol imports. This caused `TypeError: Cannot read properties of undefined (reading 'tap')` during the webpack build phase in Next.js 15.5.9.

The previous session's fix (task 2475 first attempt) added NMRP to handle `node:` protocol imports, but this approach causes a `tap` error in the webpack compilation phase. The `init()` approach works for getting the webpack module, but the NMRP itself triggers an error during webpack's build.

### Fix Applied (next.config.js)
1. **Removed `NormalModuleReplacementPlugin` and `createRequire`** — these caused the tap error during build. The webpack callback is now simplified back to `(webpackConfig) => {...}` without the `{ isServer, isClient }` parameter.

2. **Kept `.node$` alias** — redirects `.node` binary file requests to `src/server/utils/empty-stub.js`. This handles actual binary file imports, not `node:` protocol.

3. **Removed `undici` from webpack externals** — it is already in `serverExternalPackages`, so webpack external handling is redundant.

4. **Kept gravatar CSP fix** — `gravatar.com` → `*.gravatar.com` for admin routes.

### Why NMRP caused the error
The `NormalModuleReplacementPlugin` creates successfully (verified in Node REPL), but during webpack's actual compilation when it tries to `tap` into webpack's resolver hooks, something is undefined. This is a Next.js 15.5.9 + webpack 5.98.0 incompatibility with how NMRP interacts with the resolver plugin system during the build.

Since all native packages (`@napi-rs/canvas`, etc.) are in `serverExternalPackages`, webpack never processes their `node:` imports in the browser bundle, so no NMRP interception is needed.

### Verification
- `pnpm verify` passes (typecheck, lint)
- `npx tsc --noEmit` passes
- `pnpm lint` passes (one pre-existing warning in LatexDocumentViewer)
