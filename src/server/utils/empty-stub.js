// This stub is used as the resolve target for all `node:` protocol imports in browser builds.
// Native Node.js modules (undici, @napi-rs/canvas, etc.) are server-only and must never
// execute in the browser. Webpack still analyzes these modules for tree-shaking even when
// marked as external, and encounters node:console / node:crypto / etc. which it cannot resolve.
// Aliasing all node: imports to this empty stub allows the browser build to complete.
// The actual server-side code never runs in the browser, so this stub is never invoked.

module.exports = {}
