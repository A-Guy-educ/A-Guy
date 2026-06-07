## Fix: CI Build Failure — UnhandledSchemeError for node: URL scheme imports

### Root Cause

The previous session's fix used `resolve.alias` entries for individual `node:` protocol modules (`node:fs`, `node:os`, `node:path`, `node:perf_hooks`, `node:process`). These were ineffective — `resolve.alias` is consulted **after** webpack's scheme handler runs, and the scheme handler for `node:` throws `UnhandledSchemeError` before alias resolution occurs.

The import chain was:
- `payload.config.ts` → `payload` → `payload/dist/utilities/telemetry/conf/index.js` → `node:fs`, `node:os`
- `payload.config.ts` → `payload` → `payload/dist/utilities/telemetry/events/serverInit.js` → `node:path`
- `payload.config.ts` → `payload` → `payload/bin/generateImportMap/index.js` → `node:process`
- `payload.config.ts` → `@genkit-ai/googleai` → `node-fetch` → `node:http`, `node:https`, `node:net`

### Fix Applied

Replaced the ineffective `resolve.alias` entries with `resolve.fallback`:

```js
webpackConfig.resolve.fallback = {
  ...webpackConfig.resolve.fallback,
  node: stubPath,
}
```

`FallbackPlugin` is checked **during** scheme resolution (before the error is thrown), and returns the fallback value instead. The single key `node` handles all `node:` protocol requests — `node:fs`, `node:os`, `node:path`, `node:perf_hooks`, `node:process`, `node:http`, `node:https`, `node:net`, `node:dns`, `node:crypto`, `node:module`, `node:diagnostics_channel`, `node:console`.

Kept `\\.node$` in `resolve.alias` for native binary files.

### Files Changed

- `next.config.js` — replaced individual `node:fs`, `node:os`, etc. alias entries with `resolve.fallback['node'] = stubPath`

### Why `resolve.fallback['node']` Works But `resolve.alias['node:fs']` Did Not

webpack 5's scheme resolver runs in this order:
1. `ResolvePluginFactory.createResolver` creates a resolver with a `node` scheme plugin
2. For `node:fs`, the scheme handler delegates to `ResolvePlugin` with request name `node` and path `fs`
3. `ResolvePlugin` checks `resolve.alias` for `node:fs` — **too late, scheme handler already threw**
4. `FallbackPlugin` is checked inside the scheme handler **before** throwing `UnhandledSchemeError`

`FallbackPlugin` with key `'node'` is checked for the `'node'` request name and returns `stubPath`, short-circuiting the error.

### Verification

- `mcp__kody-verify__verify` — ok: true, attempt 1
