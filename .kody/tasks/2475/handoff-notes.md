## CI Build Fix (session 2475): webpack browser build failures

### What was failing
Next.js browser build (`next build`) failed with:
```
Error: Node.js binary module ./node_modules/.pnpm/@napi-rs+canvas-linux-x64-gnu@0.1.89/.../skia.linux-x64-gnu.node is not supported in the browser.
```

### Root cause — two compounding issues

**Issue 1: ESM `require` unavailable in next.config.js**
`next.config.js` uses ESM (top-level `import`), so `require` is not available in webpack config callbacks. Using `require.resolve(...)` causes `ReferenceError: require is not defined`.

Fix: Use `path.resolve(process.cwd(), ...)` instead of `require.resolve(...)`.

**Issue 2: `@napi-rs/canvas` externals incomplete**
The `@napi-rs/canvas` metapackage resolves to platform-specific packages (`@napi-rs/canvas-linux-x64-gnu`, `@napi-rs/canvas-darwin-x64`, etc.), each containing `.node` native binaries. Simply externalizing `'@napi-rs/canvas'` is insufficient because webpack resolves to the platform-specific package name.

Fix: Add regex external `/^@napi-rs\/canvas-/` to catch all platform variants:
```js
webpackConfig.externals = [
  ...(webpackConfig.externals || []),
  '@napi-rs/canvas',
  /^@napi-rs\/canvas-/,
  'undici',
]
```

### Files changed
- `next.config.js` — `import path from 'path'`, replaced `require.resolve` with `path.resolve`, added regex external for canvas platform packages

### Verification
- `mcp__kody-verify__verify` returned `ok: true` on attempt 2
