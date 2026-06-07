## Fix: CI Build Failure — UnhandledSchemeError for node: URL scheme imports

### Root Cause
The previous fix (commit 85ff3aeed) added `@payloadcms/plugin-mcp` to `webpackConfig.externals` for non-client builds, but the build still failed. The remaining errors come from two other packages:

1. **get-tsconfig** (via Payload migrations) — imports `node:fs`, `node:https`, `node:module` in its source
2. **node-fetch** (via @genkit-ai/googleai → Genkit) — imports `node:http`, `node:net`, `node:dns`

These packages are not in `externals`, so webpack analyzes their code during bundling and encounters the `node:` imports, which fail with `UnhandledSchemeError`.

### Fix Applied
Two changes in `next.config.js`:

1. **Added `get-tsconfig` to `webpackConfig.externals`** for non-client builds — prevents webpack from analyzing its internals.

2. **Added `nodeProtocolPlugin`** — a webpack resolve plugin that intercepts `node:` URL scheme imports at the resolve hook stage (stage: -100) and redirects them to `empty-stub.js`. This is necessary because webpack's scheme resolver (`resolveAsScheme.for('node')`) handles `node:` imports before the normal resolve pipeline, so `resolve.alias` cannot intercept them. By tapping the resolve hook with high priority, we catch `node:` imports before webpack's scheme resolver fails with `UnhandledSchemeError`.

### Files Changed
- `next.config.js` — added `get-tsconfig` to non-client externals; added `nodeProtocolPlugin` resolve plugin

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1

### Why the plugin approach works
Webpack's resolve pipeline: resolve hooks → scheme resolution (resolveAsScheme) → alias/fallback. The scheme resolver runs BEFORE our plugin taps the resolve hook unless we use a high-priority stage (stage: -100). At that priority, our plugin runs before webpack's scheme resolver processes the request, letting us redirect `node:` imports to the stub before they fail.
