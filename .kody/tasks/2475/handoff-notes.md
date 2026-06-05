## CI Build Fix (session 2475-B): require is not defined in ESM next.config.js

### What was failing
The Next.js browser build failed with:
- `ReferenceError: require is not defined` at `next.config.js:155`

### Root cause
The previous fix (session 2475-A) used `require.resolve('./src/server/utils/empty-stub.js')` in the webpack config alias. However, `next.config.js` uses ESM (top-level `import`), so `require` is not available in that context.

### Fix applied
Replaced `require.resolve(...)` with `path.resolve(process.cwd(), 'src/server/utils/empty-stub.js')`:
- Added `import path from 'path'` at the top of `next.config.js`
- Changed the alias target from `require.resolve(...)` to `path.resolve(process.cwd(), 'src/server/utils/empty-stub.js')`

`process.cwd()` gives the project root at build time, same as what `require.resolve` would have resolved to.

### Files changed
- `next.config.js` — added `import path from 'path'`, replaced `require.resolve` with `path.resolve(process.cwd(), ...)`

### Verification
- `mcp__kody-verify__verify` returned ok: true on attempt 1

---

## Prior session context (2475-A)
Added `resolve.alias` to redirect all `node:` protocol imports to an empty stub to fix `UnhandledSchemeError: Reading from "node:console" is not handled by plugins`. The `empty-stub.js` file was also created.
