# Fix: Next.js build OOM - lazy-load heavy packages and enable Payload server bundle optimization

## Problem

`next build` is OOM-killing the GitHub Actions runner during the warmup step. Total RAM consumption exceeds the ~7GB runner limit.

## Root Cause

The client bundle includes heavy packages that should never be in the initial load:
- `mathlive` — math rendering (~1MB+)
- `jsxgraph` — interactive math visualization
- `tesseract.js` — OCR library (~50MB)
- `pdfjs-dist` — PDF rendering

Additionally, `devBundleServerPackages: false` causes Payload to include server-side code in the client bundle.

## Fix 1: Lazy-load heavy packages

Lazy-load the following via `next/dynamic` with `ssr: false`:
- Exercise content editor components that use `mathlive`, `jsxgraph`
- PDF viewer components that use `pdfjs-dist`
- OCR components that use `tesseract.js`

Do NOT import these at the top level of any page or shared component.

## Fix 2: Enable Payload server bundle optimization

In `next.config.js`, change:
```js
const configWithPayload = withPayload(nextConfig, { devBundleServerPackages: false })
```
to:
```js
const configWithPayload = withPayload(nextConfig, { devBundleServerPackages: true })
```

Monitor for any runtime errors after this change — if server-only packages are imported client-side, they'll fail at runtime instead of build time.