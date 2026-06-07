## Fix: CI Build Failure — Hook resolve.scheme doesn't exist

### Root Cause
The `next.config.js` webpack configuration included a `nodeProtocolPlugin` that tapped the `resolve.scheme` hook to intercept `node:` URL scheme imports from packages like `get-tsconfig`. However, this hook was removed or renamed in webpack 5.98.0 (bundled with Next.js 15.5.9), causing the build to fail with `Hook resolve.scheme doesn't exist` at line 171.

### Fix Applied
Removed the `nodeProtocolPlugin` and its associated `resolve.scheme` tap. The `get-tsconfig` package is already marked as external in `webpackConfig.externals` for non-client builds — webpack never analyzes its internals, so the `node:` imports inside it are never encountered. The `resolve.scheme` hook interception was redundant.

### Files Changed
- `next.config.js` — removed `nodeProtocolPlugin` and its `resolve.scheme` tap (~15 lines)

### Why the Plugin Was Unnecessary
The `externals` configuration (applied in the non-client branch) tells webpack to treat `get-tsconfig` as a Node.js native module loaded via `require()` at runtime. Webpack never analyzes the package's source code, so the `node:fs`, `node:https`, `node:module` imports inside it are never seen. The `resolve.scheme` hook was an attempted workaround that is incompatible with webpack 5.98.0.

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
