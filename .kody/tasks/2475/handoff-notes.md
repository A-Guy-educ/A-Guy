## Fix: CI Build Failure on PR #2475 — node: URL scheme not intercepted

### Root Cause
The previous fix re-added the `\.node$` alias and `resolve.fallback.node: false` to the client webpack config, but this only handles:
- `\.node$` → file paths ending in `.node` (native binaries)
- `resolve.fallback.node: false` → bare `require('node')` module requests

It does NOT handle `node:console`, `node:crypto`, `node:dns`, `node:diagnostics_channel` which are URL scheme imports (`require('node:console')`).

These imports come from undici's mock utility files (`pending-interceptors-formatter.js`, `snapshot-utils.js`, `dns.js`, etc.) which are pulled into the browser webpack via Payload's `safeFetch.js`.

### Fix Applied
Added `resolve.alias` entries for each `node:` URL scheme import:
- `'node:console': stubPath`
- `'node:crypto': stubPath`
- `'node:dns': stubPath`
- `'node:diagnostics_channel': stubPath`

This redirects all `node:` URL scheme imports in browser builds to the empty stub, preventing webpack from failing to resolve them.

### Files Changed
- `next.config.js` — added 4 `node:` URL scheme aliases to client webpack resolve.alias

### Key Insight
`resolve.fallback` and `resolve.alias` are separate webpack mechanisms:
- `resolve.fallback` maps bare module names to fallback paths
- `resolve.alias` maps exact module names/patterns to alternative paths
- The `node:` URL scheme is NOT handled by `resolve.fallback.node: false`

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 1
