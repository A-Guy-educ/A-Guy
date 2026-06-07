## Fix: CI Build Failure — `_webpack.WebpackError is not a constructor`

### Root Cause
Next.js 15.5.9 ships with webpack 5.98.0. In this version, `WebpackError` was removed from `next/dist/compiled/webpack/webpack` (which is what `require("next/dist/compiled/webpack/webpack")` returns). The minify-webpack-plugin uses `new _webpack.WebpackError(...)` to construct error objects when minification fails, but `_webpack.WebpackError` is `undefined`, causing `TypeError: _webpack.WebpackError is not a constructor`.

`WebpackError` IS available in `bundle5().webpack.WebpackError`, but the plugin requires the wrong path.

### Fix Applied
Created `scripts/patch-next-minify-webpack.cjs` — a Node.js script that:
1. Finds all installed copies of the minify-webpack-plugin source file in `node_modules/.pnpm`
2. Checks for a `// __PATCHED_MINIFY_WEBPACK_PLUGIN__` marker to avoid double-patching
3. Replaces the `buildError` function to use `Error` as a fallback when `WebpackError` is unavailable

Added to `package.json`:
```json
"prebuild": "node scripts/patch-next-minify-webpack.cjs"
```

The `prebuild` script runs automatically before every `pnpm build`, ensuring the patch is applied regardless of whether `node_modules` came from a fresh install or a cache restore.

### Files Changed
- `package.json` — added `"prebuild": "node scripts/patch-next-minify-webpack.cjs"` before the build script
- `scripts/patch-next-minify-webpack.cjs` (new) — patches minify-webpack-plugin to handle missing WebpackError

### Why a prebuild script instead of patch-package
`patch-package` requires adding a new devDependency and configuring `.npmrc` for pnpm's postinstall scripts. A simple prebuild patching script achieves the same result without new dependencies and works reliably with pnpm's caching model.

### Verification
- `mcp__kody-verify__verify` — ok: true, attempt 2
