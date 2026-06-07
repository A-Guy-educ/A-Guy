#!/usr/bin/env node
/**
 * Patch Next.js 15.5.9 webpack issues:
 *
 * 1. minify-webpack-plugin: Fix WebpackError constructor issue
 *    webpack 5.98.0 (bundled with Next.js 15.5.9) removed WebpackError from
 *    `next/dist/compiled/webpack/webpack`. The minify-webpack-plugin tries to use
 *    `new _webpack.WebpackError(...)` where _webpack.WebpackError is undefined,
 *    causing: TypeError: _webpack.WebpackError is not a constructor
 *
 * 2. terser-webpack-plugin: Create missing src stub
 *    webpack 5.98.0 bundled in Next.js requires
 *    `next/dist/build/webpack/plugins/terser-webpack-plugin/src` which does not
 *    exist in terser-webpack-plugin@5.3.9 (no src/ directory). We create a stub
 *    src/index.js that re-exports from dist/ so the require resolves correctly.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Find all installed Next.js packages (handles pnpm store structure)
function findMinifyWebpackPluginPaths() {
  try {
    const result = execSync(
      'find node_modules/.pnpm -path "*/next/dist/build/webpack/plugins/minify-webpack-plugin/src/index.js" 2>/dev/null',
      { encoding: 'utf8' }
    )
    return result.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// Find terser-webpack-plugin installations that need src stub
function findTerserPluginSrcStubs() {
  // webpack 5.98.0 (bundle5.js) requires next/dist/build/webpack/plugins/terser-webpack-plugin/src.
  // This path is inside the next package. We create the src/ directory inside the next package's
  // dist/build/webpack/plugins/ directory, with an index.js that re-exports from the
  // installed terser-webpack-plugin dist/.
  try {
    // Find all next installations
    const nextPaths = execSync(
      'find node_modules/.pnpm -path "*/next@15.5.9*/node_modules/next/dist/build/webpack/plugins" -type d 2>/dev/null',
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter(Boolean)

    // For each next installation, create terser-webpack-plugin/src under its plugins dir
    return nextPaths.map((pluginsDir) => {
      const terserSrcDir = path.join(pluginsDir, 'terser-webpack-plugin', 'src')
      // Find the dist/ dir of terser-webpack-plugin relative to this next package
      // In pnpm workspaces, terser-webpack-plugin is at workspace root node_modules/terser-webpack-plugin
      const terserDistPath = path.resolve(
        process.cwd(),
        'node_modules',
        'terser-webpack-plugin',
        'dist'
      )
      return { srcDir: terserSrcDir, distDir: terserDistPath }
    })
  } catch {
    return []
  }
}

const PATCHED_MARKER = '// __PATCHED_MINIFY_WEBPACK_PLUGIN__'

function isAlreadyPatched(content) {
  return content.includes(PATCHED_MARKER)
}

function getPatchedContent(originalContent) {
  if (isAlreadyPatched(originalContent)) {
    return null
  }

  const oldBuildError = `function buildError(error, file) {
    if (error.line) {
        return new _webpack.WebpackError(\`\${file} from Minifier\\n\${error.message} [\${file}:\${error.line},\${error.col}]\${error.stack ? \`\\n\${error.stack.split('\\n').slice(1).join('\\n')}\` : ''}\`);
    }
    if (error.stack) {
        return new _webpack.WebpackError(\`\${file} from Minifier\\n\${error.message}\\n\${error.stack}\`);
    }
    return new _webpack.WebpackError(\`\${file} from Minifier\\n\${error.message}\`);
}`

  const newContent = `// __PATCHED_MINIFY_WEBPACK_PLUGIN__
function getWebpackErrorClass() {
    if (typeof _webpack.WebpackError === 'function') {
        return _webpack.WebpackError;
    }
    // webpack 5.98.0+ removed WebpackError from compiled bundle; use Error as fallback
    return Error;
}
function buildError(error, file) {
    const WebpackError = getWebpackErrorClass();
    const msg = \`\${file} from Minifier\\n\${error.message}\`;
    if (error.line) {
        const fullMsg = \`\${msg} [\${file}:\${error.line},\${error.col}]\${error.stack ? \`\\n\${error.stack.split('\\n').slice(1).join('\\n')}\` : ''}\`;
        return new WebpackError(fullMsg);
    }
    if (error.stack) {
        return new WebpackError(\`\${msg}\\n\${error.stack}\`);
    }
    return new WebpackError(msg);
}`

  return originalContent.replace(oldBuildError, newContent)
}

function patchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const patched = getPatchedContent(content)

  if (!patched) {
    console.log(`  Already patched: ${filePath}`)
    return false
  }

  fs.writeFileSync(filePath, patched, 'utf8')
  console.log(`  Patched: ${filePath}`)
  return true
}

// Create terser-webpack-plugin src/index.js stub that re-exports from dist/
function createTerserSrcStub(srcDir, distDir) {
  if (fs.existsSync(srcDir)) {
    console.log(`  Terser src stub already exists: ${srcDir}`)
    return false
  }

  fs.mkdirSync(srcDir, { recursive: true })
  // Re-export from the terser-webpack-plugin dist/ directory using an absolute path.
  // This ensures the stub resolves correctly regardless of where the next package is installed.
  const absoluteDist = path.resolve(process.cwd(), 'node_modules', 'terser-webpack-plugin', 'dist')
  fs.writeFileSync(
    path.join(srcDir, 'index.js'),
    `"use strict"\n\n// Stub for webpack 5.98.0 which requires terser-webpack-plugin/src.\n// terser-webpack-plugin only ships dist/. This re-exports from dist/.\nmodule.exports = require("${absoluteDist.replace(/\\/g, '\\\\')}/index.js");\n`,
    'utf8'
  )
  console.log(`  Created terser src stub: ${srcDir}/index.js`)
  return true
}

function main() {
  // --- Patch 1: minify-webpack-plugin WebpackError fallback ---
  const minifyPaths = findMinifyWebpackPluginPaths()
  if (minifyPaths.length > 0) {
    console.log('patch-next-minify-webpack: applying minify-webpack-plugin WebpackError fallback patch...')
    let patchedCount = 0
    for (const filePath of minifyPaths) {
      if (patchFile(filePath)) {
        patchedCount++
      }
    }
    console.log(`patch-next-minify-webpack: done (${patchedCount} minify-webpack-plugin files patched)`)
  } else {
    console.log('patch-next-minify-webpack: no minify-webpack-plugin found, skipping')
  }

  // --- Patch 2: terser-webpack-plugin src stub ---
  const terserSrcStubs = findTerserPluginSrcStubs()
  if (terserSrcStubs.length > 0) {
    console.log('patch-next-minify-webpack: creating terser-webpack-plugin src stubs...')
    let stubCount = 0
    for (const { srcDir, distDir } of terserSrcStubs) {
      if (createTerserSrcStub(srcDir, distDir)) {
        stubCount++
      }
    }
    console.log(`patch-next-minify-webpack: done (${stubCount} terser-webpack-plugin src stubs created)`)
  } else {
    console.log('patch-next-minify-webpack: no next installation with terser-webpack-plugin path found, skipping src stub creation')
  }
}

main()
