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

**Issue 3: `node:` protocol imports unresolved**
`resolve.alias` with `'^node:(.*)$'` does not work — webpack 5 treats string keys as literals, not regex. `resolve.fallback.node: false` is the correct webpack 5 API for `node:` protocol imports.

**Issue 4: `.node` native binary files trigger error-checker**
Even with regex externals, `next-error-browser-binary-loader` runs on `.node` files before webpack's external check, causing "not supported in browser" errors.

### Fix applied

**For `node:` protocol imports** — `resolve.fallback.node: false`:
```js
webpackConfig.resolve.fallback = {
  ...webpackConfig.resolve.fallback,
  node: false,
}
```

**For `.node` native binary files** — `resolve.alias` with regex:
```js
webpackConfig.resolve.alias = {
  ...webpackConfig.resolve.alias,
  '\\.node$': path.resolve(process.cwd(), 'src/server/utils/empty-stub.js'),
}
```

**For canvas platform packages** — regex externals:
```js
webpackConfig.externals = [
  ...(webpackConfig.externals || []),
  '@napi-rs/canvas',
  /^@napi-rs\/canvas-/,
  'undici',
]
```

### Files changed
- `next.config.js` — browser webpack config block: added `\\.node$` resolve.alias, kept `resolve.fallback.node: false`, kept regex externals for canvas packages
- `src/server/utils/empty-stub.js` — empty stub file for redirecting `.node` files

### Verification
- `pnpm lint` — passes
- `mcp__kody-verify__verify` — `ok: true` on attempt 3
