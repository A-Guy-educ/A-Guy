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

**Issue: `!isServer` condition skips Edge builds in Next.js 15.5.9**

In Next.js 15.5.9, `isServer` passed to the webpack config function is actually `isNodeOrEdgeCompilation = isNodeServer || isEdgeServer`. This means `isServer = true` for BOTH Node.js server builds AND Edge builds.

So `if (!isServer)` evaluates to `false` for Edge builds — the entire webpack config block (`.node` alias, `resolve.fallback.node: false`, canvas/undici externals) is SKIPPED for Edge builds.

The `node:` protocol imports (from `undici`) and `.node` native binaries (from `@napi-rs/canvas-linux-x64-gnu`) are NOT handled for Edge builds, causing:
```
UnhandledSchemeError: Reading from "node:console" is not handled by plugins
Error: Node.js binary module ...skia.linux-x64-gnu.node is not supported in the browser.
```

**Additional issues (already fixed previously):**
- `resolve.alias` with `'^node:(.*)$'` does not work — webpack 5 treats string keys as literals. `resolve.fallback.node: false` is the correct webpack 5 API.
- `@napi-rs/canvas` metapackage resolves to platform-specific packages not in externals. Regex externals `/^@napi-rs\/canvas-/` are needed.
- ESM `next.config.js` uses `path.resolve` not `require.resolve`.

### Fix applied

**Condition fix: `!isServer` → `!isClient`**

Changed the webpack config condition from `if (!isServer)` to `if (!isClient)`. Since `isServer` is `isNodeOrEdgeCompilation` (true for both Node AND Edge builds), `!isServer` was false for Edge. Using `!isClient` correctly identifies non-browser builds (Edge and server both have `isClient = false`).

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
- `next.config.js` — webpack config: changed `if (!isServer)` to `if (!isClient)` so the config also applies to Edge builds. Also: added `\\.node$` resolve.alias, kept `resolve.fallback.node: false`, kept regex externals for canvas packages.
- `src/server/utils/empty-stub.js` — empty stub file for redirecting `.node` files

### Verification
- `mcp__kody-verify__verify` — `ok: true` on attempt 1
