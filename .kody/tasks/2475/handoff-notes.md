## CI Build Fix: webpack browser build failures (v3)

### What was failing
CI build failed with `UnhandledSchemeError: Reading from 'node:crypto' is not handled by plugins` and `@napi-rs/canvas` binary errors during webpack compilation.

### Root cause

The v2 fix (commit cb3283fa5) removed `\.node$` resolve.alias and canvas regex externals, keeping only `undici` external and `resolve.fallback.node: false`. This was insufficient:

1. **`resolve.fallback.node: false` does NOT handle `node:` protocol imports.** The `resolve.fallback` API handles bare specifiers like `require('buffer')` → fallback, but `node:crypto`, `node:fs`, `node:http`, `node:https` use the `node:` URI scheme which webpack does not handle by default.

2. **`@napi-rs/canvas` still needs to be externalized.** While `@napi-rs/canvas` is in `serverExternalPackages` at the Next.js config level, webpack still analyzes it during tree-shaking and encounters `.node` native binaries and `node:` imports within the package.

3. **`path` import was removed but is needed** for `path.resolve(process.cwd(), ...)`.

### Fix applied (v3)

Reverted to a more complete webpack config:

1. **Re-added `import path from 'path'`** — needed for `path.resolve`

2. **Added `@napi-rs/canvas` as a string external** (not regex) — prevents canvas from being bundled; using a string rather than `/^@napi-rs\/canvas-/` avoids the minify-webpack-plugin conflict that canvas regex externals caused

3. **Re-added `resolve.alias` with `\.node$` and `^node:(.*)$`** — redirects `.node` native binaries and all `node:` protocol imports to the empty stub at `src/server/utils/empty-stub.js`. The actual server-only code never runs in the browser, so the stub is never invoked.

4. **Kept `undici` external and `resolve.fallback.node: false`** — supplements the alias approach

### Final webpack config (non-client builds)

```js
if (!isClient) {
  webpackConfig.externals = [...(webpackConfig.externals || []), 'undici', '@napi-rs/canvas']

  webpackConfig.resolve.alias = {
    ...webpackConfig.resolve.alias,
    '\\.node$': path.resolve(process.cwd(), 'src/server/utils/empty-stub.js'),
    '^node:(.*)$': path.resolve(process.cwd(), 'src/server/utils/empty-stub.js'),
  }

  webpackConfig.resolve.fallback = {
    ...webpackConfig.resolve.fallback,
    node: false,
  }
}
```

### Files changed
- `next.config.js` — re-added `import path from 'path'`, added `node:` protocol alias and `@napi-rs/canvas` external

### Key insight
`resolve.fallback.node: false` alone does NOT fix `node:` protocol errors. The `node:` scheme requires `resolve.alias` to redirect. The canvas native binary errors also require both the `\.node$` alias AND `@napi-rs/canvas` in webpack externals (serverExternalPackages alone is insufficient to prevent webpack from analyzing the package at build time).
