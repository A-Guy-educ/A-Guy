## Fix: CI Build Failure on PR #2475 (node: UnhandledSchemeError)

### Root Cause
The build was failing with `UnhandledSchemeError: Reading from "node:console" is not handled by plugins`. The webpack config had a `.node$` alias that only handles `.node` binary files, NOT `node:` URL scheme imports. Webpack 5.98.0 doesn't have a built-in handler for the `node:` scheme (only `file:` and `data:`).

The `node:` imports came from undici's internal files (`lib/mock/*.js`) which are pulled into the browser bundle via Payload's `safeFetch.js`. Even though undici is in `serverExternalPackages`, webpack still analyzes undici's internal modules during tree-shaking.

### Fix Applied (next.config.js)
1. **Restored `{ isServer, isClient }` callback parameters** — needed to apply node handling only to server/Edge builds

2. **Added `NodeSchemePlugin`** — taps `resolver.hooks.resolveForScheme.for('node')` to intercept `node:` scheme requests and redirect them to `src/server/utils/empty-stub.js`. The `resolveForScheme` hook fires BEFORE the scheme check throws `UnhandledSchemeError`, allowing us to redirect.

3. **Added `resolve.fallback.node = false`** — handles bare `node` specifiers (not `node:` scheme)

4. **Kept `\\.node$` alias** — handles `.node` binary file paths

5. **Added undici and @napi-rs/canvas to webpack externals** — explicit externalization supplement to serverExternalPackages

### Key insight: why resolve.alias can't handle node: imports
`resolve.alias` patterns like `^node:(.*)$` don't work because webpack alias only supports exact matches (`$`) and directory prefixes (`/`). The `node:` protocol is a URL scheme handled separately from module name resolution.

The correct approach is `resolveForScheme.for('node')` which is called before the scheme check. Tapping it and calling `doResolve` redirects the request to an empty stub before webpack throws the error.

### Verification
- `pnpm verify` passes (typecheck, lint) — attempt 1
