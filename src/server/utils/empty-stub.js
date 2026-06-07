// This file is a stub for webpack's .node alias.
// Native .node binary files cannot be loaded in browser environments.
// This stub prevents webpack from failing when it encounters .node files
// that are transitively referenced but cannot actually execute in the browser.
// At runtime, server-only code that imports these natives will fail appropriately
// if it ever runs in a browser context (which it should never do).
export default null
