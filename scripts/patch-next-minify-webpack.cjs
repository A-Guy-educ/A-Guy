#!/usr/bin/env node
/**
 * Patch Next.js 15.5.9's minify-webpack-plugin to fix WebpackError constructor issue.
 *
 * Root cause: webpack 5.98.0 (bundled with Next.js 15.5.9) removed WebpackError from
 * `next/dist/compiled/webpack/webpack`. The minify-webpack-plugin tries to use
 * `new _webpack.WebpackError(...)` where _webpack.WebpackError is undefined,
 * causing: TypeError: _webpack.WebpackError is not a constructor
 *
 * Fix: Replace buildError() to fall back to Error when WebpackError is unavailable.
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

function main() {
  const paths = findMinifyWebpackPluginPaths()

  if (paths.length === 0) {
    console.log('patch-next-minify-webpack: no minify-webpack-plugin found, skipping')
    return
  }

  console.log('patch-next-minify-webpack: applying webpack error fallback patch...')
  let patchedCount = 0
  for (const filePath of paths) {
    if (patchFile(filePath)) {
      patchedCount++
    }
  }
  console.log(`patch-next-minify-webpack: done (${patchedCount} files patched)`)
}

main()
