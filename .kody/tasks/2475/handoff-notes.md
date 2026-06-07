## Fix: CI Build Failure — terser-webpack-plugin/src MODULE_NOT_FOUND

### Root Cause

webpack 5.98.0 (bundled as `bundle5.js` inside Next.js 15.5.9) requires `next/dist/build/webpack/plugins/terser-webpack-plugin/src` at runtime. This path does not exist because:

1. `terser-webpack-plugin` only ships `dist/` (no `src/` directory) in both versions 5.3.9 and 5.4.0
2. Even though `terser-webpack-plugin@5.3.9` is a devDependency of the `next` package, pnpm deduplication means it's only installed at the workspace root `node_modules/terser-webpack-plugin/` — NOT inside the `next` package's own `node_modules/`
3. When webpack 5.98.0's `bundle5.js` requires `next/dist/build/webpack/plugins/terser-webpack-plugin/src`, Node module resolution looks inside the `next` package (at `next/dist/build/webpack/plugins/terser-webpack-plugin/src`) and finds nothing

### Fix Applied

1. **package.json**: Added `terser-webpack-plugin@5.3.9` to `devDependencies` and a pnpm `overrides` entry forcing that exact version. This ensures `5.3.9` is installed at the workspace root alongside the existing `5.4.0`.

2. **scripts/patch-next-minify-webpack.cjs**: Extended the prebuild script to also create the missing `src/index.js` stub inside the `next` package's webpack plugins directory:
   - Finds all `next@15.5.9` installations in `node_modules/.pnpm/`
   - Creates `next/dist/build/webpack/plugins/terser-webpack-plugin/src/index.js`
   - The stub uses an absolute path to `node_modules/terser-webpack-plugin/dist/index.js` to re-export TerserPlugin
   - This makes `bundle5.js`'s `require('next/dist/build/webpack/plugins/terser-webpack-plugin/src')` resolve successfully

### Files Changed

- `package.json` — added `terser-webpack-plugin@5.3.9` to devDependencies and pnpm overrides
- `scripts/patch-next-minify-webpack.cjs` — extended to create terser-webpack-plugin/src stub

### Why Two Changes Are Needed

The pnpm override + devDependency ensures `terser-webpack-plugin@5.3.9` is installed in the workspace root. The prebuild script creates the stub at the exact path `bundle5.js` requires (`next/dist/build/webpack/plugins/terser-webpack-plugin/src`). Both are required: one installs the package, the other creates the missing `src/` path webpack looks for.

### Verification

- `mcp__kody-verify__verify` — ok: true, attempt 1
