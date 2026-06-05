## CI Build Fix: node: protocol alias for browser webpack builds

### What was failing
The Next.js browser build failed with:
- `Error: Node.js binary module @napi-rs/canvas... is not supported in the browser`
- `UnhandledSchemeError: Reading from "node:console" is not handled by plugins`

### Root cause
The previous fix (session 2475-A) used `webpack.externals` to mark `@napi-rs/canvas` and `undici` as external. However, `externals` only prevents webpack from EMITTING those modules in the output bundle — it does NOT prevent webpack from ANALYZING them for tree-shaking purposes. During analysis, webpack follows the internal dependency chain of `undici` and encounters `node:console`, `node:crypto`, `node:dns`, etc. imports which it cannot resolve (no plugin handles `node:` scheme).

The chain: `payload.config.ts` → `safeFetch.js` (Payload) → `undici/index.js` → `undici/lib/mock/*.js` → `node:console`

### Fix applied
Added `resolve.alias` to redirect all `node:` protocol imports to an empty stub:
```js
webpackConfig.resolve.alias = {
  ...webpackConfig.resolve.alias,
  '^node:(.*)$': require.resolve('./src/server/utils/empty-stub.js'),
}
```
This tells webpack: "when you see `import 'node:console'`, resolve it to `empty-stub.js` instead." Since `empty-stub.js` is just `module.exports = {}`, webpack can resolve it without error.

### Why this is safe
- `node:` imports are Node.js built-ins that only exist in server environments
- The code paths that use them (`undici`, `@napi-rs/canvas`) are server-only and never execute in the browser
- Even if webpack analyzed them (and they are now redirected to a stub), the actual server code is never shipped to the browser

### Files changed
- `next.config.js` — added `resolve.alias` for `^node:(.*)$` pattern in browser builds
- `src/server/utils/empty-stub.js` (new) — empty module used as the alias target

### Verification
- `mcp__kody-verify__verify` returned ok: true on attempt 1
