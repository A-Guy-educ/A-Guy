## CI Build Fix: webpack externals instead of resolve.alias for browser builds

### What was failing
The Next.js browser build failed with:
- `Error: Node.js binary module @napi-rs/canvas... is not supported in the browser`
- `UnhandledSchemeError: Reading from "node:console" is not handled by plugins`

### Root cause
The previous fix (task 2475, first session) used `resolve.alias` to stub `@napi-rs/canvas` and `undici` for browser builds:
```js
if (!isServer) {
  webpackConfig.resolve.alias = {
    '@napi-rs/canvas': false,
    undici: false,
  }
}
```
This did NOT work because `resolve.alias` to `false` only makes the import resolve to "module not found" — it does NOT prevent webpack from following the internal dependency chain of the package. Webpack still reads `@napi-rs/canvas`'s `js-binding.js` which requires the `.node` binary, triggering `next-error-browser-binary-loader`. Similarly, webpack still analyzes `undici`'s internal files which use `node:` scheme imports.

### Fix applied (this session)
Replaced `resolve.alias` with `webpack.externals`:
```js
if (!isServer) {
  webpackConfig.externals = [
    ...(webpackConfig.externals || []),
    '@napi-rs/canvas',
    'undici',
  ]
}
```
`externals` tells webpack to completely skip analyzing these packages — no dependency chain traversal, no `.node` file loading, no `node:` scheme resolution. Webpack leaves `require('@napi-rs/canvas')` / `require('undici')` in the output bundle, but these are dead code paths (server-only) that never execute in the browser.

### Files changed
- `next.config.js` — replaced `resolve.alias` with `webpack.externals` for browser builds

### Why this is safe
- `@napi-rs/canvas` is only used in `pdf-render-service.ts` which is called from server-side job tasks (`pdf-to-exercises-v2-task.ts`), never from browser code
- `undici` is used in Payload's `safeFetch.js` which is also server-only
- Browser code paths that reference these modules are unreachable dead code

### Verification
- `mcp__kody-verify__verify` returned ok: true on attempt 1
