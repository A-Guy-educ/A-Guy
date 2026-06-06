## Fix: CI Build Failure on PR #2475 (NodeSchemePlugin tap error)

### Root Cause
The previous fix attempt added a `NodeSchemePlugin` class that tried to tap `compiler.resolverFactory.hooks.resolve` to handle `node:` protocol imports. However, in Next.js 15.5.9's webpack, `resolverFactory.hooks.resolve` is `undefined`, causing `TypeError: Cannot read properties of undefined (reading 'tap')` at line 165 of next.config.js.

### Fix Applied
Removed the entire `NodeSchemePlugin` block, the `isServer`/`isClient` callback parameters, the `path` import, and all related webpack config additions (externals, alias, fallback).

The `node:` protocol handling was unnecessary because `undici` and `@napi-rs/canvas` are already in `serverExternalPackages` — webpack treats them as external and never processes their `node:` imports for browser builds. The dev branch builds without any explicit `node:` protocol handling.

### Files Changed
- `next.config.js` — removed NodeSchemePlugin, node: handling code, path import, and isServer/isClient callback params

### Verification
- `pnpm verify` passes (typecheck, lint) — attempt 1

### Key Insight
The `node:` protocol imports (from undici internals) are only analyzed during tree-shaking. Since undici is in `serverExternalPackages`, webpack never analyzes its internals for the browser bundle. No explicit `node:` handling is needed.
