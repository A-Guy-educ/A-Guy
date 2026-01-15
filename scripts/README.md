# PDF.js Vercel Blob CDN Setup

This guide explains how to upload PDF.js assets to Vercel Blob storage for a stable, self-hosted CDN solution.

## Why Vercel Blob CDN?

- ✅ **Stable versions** - No auto-updates breaking compatibility
- ✅ **Minimal repo footprint** - Zero PDF.js files in repository
- ✅ **You control updates** - Update only when you choose
- ✅ **Fast CDN delivery** - Vercel's global edge network
- ✅ **Manager approved** - "External reference" approach

## Prerequisites

### 1. Get Vercel Blob Token

You already have Vercel Blob configured for Media storage. The token should be in your `.env.local`:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXX
```

If not, get it from:

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Storage tab
4. Create or view your Blob store
5. Copy the `BLOB_READ_WRITE_TOKEN`
6. Add to `.env.local`

### 2. Ensure Dependencies

The script uses `@vercel/blob` which is already installed via `@payloadcms/storage-vercel-blob`.

## Upload Process

### Step 1: Run Upload Script

```bash
node scripts/upload-pdfjs-to-blob.mjs
```

This will upload:

- **Viewer files** (from `public/pdfjs/`):
  - `viewer.html`
  - `viewer.mjs`
  - `viewer.css`

- **Core library** (from `node_modules/pdfjs-dist/`):
  - `build/pdf.mjs`
  - `build/pdf.worker.mjs`
  - `build/pdf.sandbox.mjs`
  - `web/images/` (48+ icon SVGs)
  - `web/locale/` (translations)
  - `cmaps/` (character maps)
  - `standard_fonts/` (fonts)

**Expected output:**

```
🚀 Starting PDF.js upload to Vercel Blob...
📦 PDF.js version: 4.4.168

📤 Uploading viewer files from public/pdfjs...
✅ Uploaded: pdfjs/4.4.168/viewer.html
✅ Uploaded: pdfjs/4.4.168/viewer.mjs
✅ Uploaded: pdfjs/4.4.168/viewer.css

📤 Uploading PDF.js assets from node_modules...
📁 Uploading 48 files from web/images/...
✅ Uploaded: pdfjs/4.4.168/web/images/toolbarButton-zoomIn.svg
...

✅ Upload complete!

📋 Base URL for assets:
   https://{your-blob-store}/pdfjs/4.4.168/

🔗 Key URLs:
   viewer.html:  https://xxxxx.public.blob.vercel-storage.com/pdfjs/4.4.168/viewer.html
   viewer.mjs:   https://xxxxx.public.blob.vercel-storage.com/pdfjs/4.4.168/viewer.mjs
   ...
```

**Save these URLs!** You'll need them for the next step.

### Step 2: Update React Components

Replace iframe `src` to load from Blob CDN:

**Before:**

```typescript
// src/components/Media/PDFMedia/index.tsx
const viewerUrl = `/pdfjs/viewer.html?file=${encodeURIComponent(pdfUrl)}`
```

**After:**

```typescript
// src/components/Media/PDFMedia/index.tsx
const VIEWER_BASE_URL = 'https://xxxxx.public.blob.vercel-storage.com/pdfjs/4.4.168'
const viewerUrl = `${VIEWER_BASE_URL}/viewer.html?file=${encodeURIComponent(pdfUrl)}`
```

Update both:

- `src/components/Media/PDFMedia/index.tsx`
- `src/components/admin/MediaPreview/PDFPreview.client.tsx`

### Step 3: Remove Local Files

Once confirmed working with Blob CDN:

```bash
rm -rf public/pdfjs
```

### Step 4: Update package.json

Since we're not importing `pdfjs-dist` directly anymore (only uploading from it), you can optionally:

**Option A: Keep it** (recommended)

- Keep `pdfjs-dist` in `devDependencies` for future re-uploads
- Add comment: `"pdfjs-dist": "4.4.168", // Used by scripts/upload-pdfjs-to-blob.mjs`

**Option B: Remove it**

- Remove from package.json
- Keep node_modules cached or re-download when updating

## Future Updates

### When to Update PDF.js

Only update when:

1. Security vulnerability announced
2. Need new PDF spec features
3. Critical bug affecting your users

**Expected frequency**: Almost never (PDF.js is mature)

### How to Update

1. **Bump package version:**

   ```bash
   pnpm add -D pdfjs-dist@latest
   ```

2. **Download new viewer files** from https://github.com/mozilla/pdf.js/releases
   - Extract viewer.html, viewer.mjs, viewer.css
   - Place in `public/pdfjs/` (temporarily)

3. **Re-run upload script:**

   ```bash
   node scripts/upload-pdfjs-to-blob.mjs
   ```

4. **Update React components** with new version number:

   ```typescript
   const VIEWER_BASE_URL = 'https://xxxxx.public.blob.vercel-storage.com/pdfjs/5.x.xxx'
   ```

5. **Test thoroughly** before deploying

6. **Clean up:**
   ```bash
   rm -rf public/pdfjs
   ```

## Troubleshooting

### Script fails with "BLOB_READ_WRITE_TOKEN not set"

Add token to `.env.local`:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXX
```

### Viewer not loading

1. Check browser console for errors
2. Verify Blob URLs are accessible (open in browser)
3. Check CORS settings in Vercel Blob dashboard

### Icons not showing

The script should upload all 48+ icons from `node_modules/pdfjs-dist/web/images/`. If missing:

1. Verify icons uploaded: check Vercel Blob dashboard
2. Check viewer.css mask-image URLs point to correct Blob paths

### Version mismatch error

Ensure all components reference the same version:

- React components: `pdfjs/4.4.168/viewer.html`
- Uploaded assets: `pdfjs/4.4.168/build/pdf.mjs`
- Must match exactly

## Cost Estimate

Vercel Blob pricing (as of 2024):

- Storage: $0.15 per GB/month
- Bandwidth: $0.40 per GB

**PDF.js assets**: ~4MB = $0.0006/month storage

**Estimated traffic** (assuming 1000 PDF views/month):

- Each view loads ~5MB of assets (first visit, then cached)
- = 5GB/month = $2/month bandwidth

**Total: ~$2/month** (negligible for production app)

## Architecture

```
User Browser
    ↓
React Component (loads viewer.html from Blob)
    ↓
Vercel Blob CDN
    ├── viewer.html
    ├── viewer.mjs (loads pdf.mjs from Blob)
    ├── viewer.css (loads icons from Blob)
    └── assets/
        ├── build/pdf.mjs
        ├── build/pdf.worker.mjs
        ├── web/images/*.svg
        ├── web/locale/*.json
        ├── cmaps/*.bcmap
        └── standard_fonts/*.ttf
```

**Key benefits:**

- ✅ Zero files in repository
- ✅ Stable versions under your control
- ✅ Fast global CDN delivery
- ✅ One-time setup, rarely updated

## Questions?

See [CLAUDE_INTERNAL.md](../CLAUDE_INTERNAL.md) "External Libraries & CDN Strategy" section for design decisions and lessons learned.
