## Fix: CI Build Failure — UnhandledSchemeError for node: URL scheme imports

### Root Cause
The previous fix (commit 3bcdd3563) attempted to intercept `node:` URL scheme imports using the webpack `resolve` hook with `stage: -100`. However, in webpack 5, `node:` URL scheme requests go through `resolveForScheme.for('node')` **before** the resolve hook chain — `UnhandledSchemeError` is thrown before any resolve hook fires. Tapping the `resolve` hook cannot intercept `node:` scheme requests.

### Fix Applied
Two changes in `next.config.js`:

1. **Added `node-fetch` to `serverExternalPackages`** — `node-fetch` (used by Genkit) was not in the server external packages list, so webpack traced its internals and encountered `node:http`, `node:https`, `node:net`, `node:dns` imports.

2. **Replaced `nodeProtocolPlugin` resolve hook with `resolve.scheme` hook** — The `resolve.scheme` hook (AsyncSeriesWaterfallHook) is the correct webpack 5 hook for scheme-level interception. It fires during scheme resolution, allowing us to register a handler for the `node` scheme before `UnhandledSchemeError` is thrown. The plugin now calls `resolver.getHook('resolve.scheme').tapAsync(...)` and returns the stub path for the `node` scheme.

### Files Changed
- `next.config.js` — added `node-fetch` to serverExternalPackages; rewrote `nodeProtocolPlugin` to use `resolve.scheme` hook instead of `resolve` hook

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1

### Why the fix works
Webpack 5 resolves `node:fs` by first calling `resolveForScheme.for('node')`. If this returns `undefined` (NodeStuffPlugin not registered), `UnhandledSchemeError` is thrown immediately — the resolve hook is never reached. The `resolve.scheme` hook fires during scheme resolution, before the error is thrown, allowing our plugin to return a result for the `node` scheme. Webpack then resolves the returned stub path as a normal file request.
