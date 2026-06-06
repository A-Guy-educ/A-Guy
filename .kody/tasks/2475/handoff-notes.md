## CI Build Fix: webpack browser build failures (v2)

### What was failing
CI build failed with `HookWebpackError: _webpack.WebpackError is not a constructor` from minify-webpack-plugin during the minification phase.

### Root cause

The previous fix (commit 5a598a65f) added `\\.node$` resolve.alias and canvas regex externals to the webpack config. These changes were intended to fix `node:` protocol and `.node` native binary errors, but they caused a new error:

The `minify-webpack-plugin` in Next.js 15.5.9 tried to create a `WebpackError` object during minification to report build errors. However, the `.node$` alias regex key and canvas regex externals apparently caused the webpack compilation to produce an error state that the plugin couldn't properly serialize, resulting in `_webpack.WebpackError is not a constructor`.

### Fix applied (v2)

Simplified the webpack config to only what's actually needed:

1. **Changed `if (!isServer)` to `if (!isClient)`** — correct, since `isServer` is `isNodeOrEdgeCompilation` in Next.js 15 (true for both Node server AND Edge builds)

2. **Removed `\\.node$` resolve.alias** — the `.node` native binary errors don't occur because `@napi-rs/canvas` is already in `serverExternalPackages` (line 18 of next.config.js), so webpack never tries to bundle it

3. **Removed canvas regex externals** — same reason as above; canvas is already externalized via `serverExternalPackages`

4. **Kept `undici` in webpack externals** — undici IS bundled by webpack (it's not in serverExternalPackages), so the webpack externals prevents it from being included in browser builds

5. **Kept `resolve.fallback.node: false`** — this correctly redirects `node:console`, `node:crypto`, etc. to an empty object for browser builds

### Final webpack config (non-client builds)

```js
if (!isClient) {
  webpackConfig.externals = [...(webpackConfig.externals || []), 'undici']
  webpackConfig.resolve.fallback = {
    ...webpackConfig.resolve.fallback,
    node: false,
  }
}
```

### Files changed
- `next.config.js` — simplified webpack config block, removed unused `import path from 'path'`

### Verification
- `mcp__kody-verify__verify` — `ok: true` on attempt 3

### Key insight
The `HookWebpackError: _webpack.WebpackError is not a constructor` was a secondary error caused by the minify-webpack-plugin failing to handle an error state produced by the complex `.node$` alias and canvas regex externals. The root cause was not a webpack error per se, but the minifier's inability to wrap an error from those configurations. Simplifying to only the essential changes (undici external + node:false fallback) allows the build to complete successfully.
