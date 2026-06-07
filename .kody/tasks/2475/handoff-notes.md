## Fix: CI Build Failure on PR #2475

### Root Cause
The CI build was failing with `UnhandledSchemeError: Reading from "node:console"` and `@napi-rs/canvas... is not supported in the browser`. Despite previous attempts claiming that reverting the webpack callback to match `dev` would fix the issue (task 2475, commit 78497f311), the build continued to fail even with an identical webpack config to dev.

The actual root cause: `serverExternalPackages` in Next.js prevents packages from being included in the serverless function bundle, but webpack still performs static analysis on these packages when processing imports. For undici, this analysis encounters `node:` imports (`node:dns`, `node:diagnostics_channel`, `node:console`) which fail with `UnhandledSchemeError`. The `.node` native binaries from @napi-rs/canvas fail with "not supported in the browser".

### Fix Applied
1. Added `webpackConfig.externals` for `undici` and `@napi-rs/canvas` for non-client builds (using `!isClient` guard)
2. Added `webpackConfig.resolve.alias` for `\\.node$` to redirect native binary loads to an empty stub file
3. Added `webpackConfig.resolve.fallback.node = false` to handle node: URL schemes
4. Created `src/server/utils/empty-stub.js` as the stub target

### Files Changed
- `next.config.js` — updated webpack callback with externals for non-client builds and .node alias
- `src/server/utils/empty-stub.js` (new) — empty stub file for .node alias redirection

### Why This Works
- `webpackConfig.externals` for non-client builds: webpack treats undici/@napi-rs/canvas as external modules (loaded from node_modules at runtime), so webpack never analyzes their internal code. This avoids the `UnhandledSchemeError`.
- `.node$` alias to stub: any `.node` native binary references get redirected to the empty stub instead of failing.
- `resolve.fallback.node = false`: tells webpack that `node:` URL schemes should be treated as external/unhandled.

### Key Implementation Details
- MUST use `!isClient` (not `webpackConfig.name !== 'client'`) to guard the externals addition
- The stub file must exist on disk — created `src/server/utils/empty-stub.js`
- The `path` module must be imported in next.config.js for `path.resolve`

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 2
