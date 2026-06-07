## Fix: CI Build Failure — UnhandledSchemeError for node: URL scheme imports

### Root Cause
`@payloadcms/plugin-mcp` was not listed in `webpackConfig.externals` for non-client builds. Even though the plugin is conditionally disabled at runtime (`process.env.MCP_ENABLED !== 'false'` evaluates to `true` by default), the plugin is still statically imported in `plugins/index.ts`, so webpack analyzes its code.

The plugin transitively imports `@modelcontextprotocol/sdk` which contains `node:fs`, `node:http`, `node:https`, and `node:module` imports. Webpack's client build doesn't handle `node:` URL schemes — only `data:` and `file:` — causing `UnhandledSchemeError`.

### Fix Applied
Added `@payloadcms/plugin-mcp` to `webpackConfig.externals` in the non-client build configuration in `next.config.js`. This tells webpack to treat the plugin as a Node.js native module and not analyze its internal code, avoiding the `node:` import errors entirely.

### Files Changed
- `next.config.js` — added `@payloadcms/plugin-mcp` to the externals list for non-client builds

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
