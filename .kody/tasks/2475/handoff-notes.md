## CI Build Fix: webpack browser build failures

### What was failing
Next.js browser build (`next build`) failed with:
```
Error: Node.js binary module ...skia.linux-x64-gnu.node is not supported in the browser.
UnhandledSchemeError: Reading from "node:console" is not handled by plugins
UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
...
```

### Root cause

Three compounding issues:

**Issue 1: ESM `require` unavailable in next.config.js**
`next.config.js` uses ESM (top-level `import`), so `require` is not available in webpack config callbacks.

**Issue 2: `@napi-rs/canvas` metapackage not fully externalized**
Webpack resolves `@napi-rs/canvas` to a platform-specific package (`@napi-rs/canvas-linux-x64-gnu`, etc.) that was not in externals.

**Issue 3: `resolve.alias` does not support regex in webpack 5**
A string key like `'^node:(.*)$'` in `resolve.alias` is treated as a **literal string**, not a regex pattern. The `node:` protocol imports (node:console, node:crypto, etc.) were never redirected because the alias never matched.

### Fix applied

Added `resolve.fallback` with `node: false` — the correct webpack 5 API for handling all `node:` protocol modules at once:

```js
webpackConfig.resolve.fallback = {
  ...webpackConfig.resolve.fallback,
  node: false,
}
```

Combined with the regex external for canvas platform packages:
```js
webpackConfig.externals = [
  ...(webpackConfig.externals || []),
  '@napi-rs/canvas',
  /^@napi-rs\/canvas-/,
  'undici',
]
```

### Files changed
- `next.config.js` — added `resolve.fallback { node: false }` in the browser webpack config block

### Verification
- `mcp__kody-verify__verify` returned `ok: true` on attempt 1

### Why the previous fix didn't work
The prior session added `'^node:(.*)$': path.resolve(...)` to `resolve.alias`. Webpack 5's `resolve.alias` does not interpret string keys as regex — it treats them literally. So the key `'^node:(.*)$'` was looked up exactly as written and never matched `node:console`, `node:crypto`, etc. The `resolve.fallback` API is the correct mechanism.
