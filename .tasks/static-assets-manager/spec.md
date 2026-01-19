# Task: StaticAssets system + PDF.js viewer powered by StaticAssets

## Goal

Implement a CMS-managed **StaticAssets** system (upload + versioning + activation) and refactor the PDF viewer route (`/api/pdfjs-viewer`) to load PDF.js viewer assets from the **active StaticAssets bundle**, removing all hardcoded CDN URLs/hashes.

## Outcomes

- Admin can upload static files and manage versions with audit trail.
- Optional support for JS/CSS as loadable runtime assets with strict security.
- PDF.js viewer assets are managed as a StaticAssets **bundle** and resolved by manifest.
- Switching the active PDF.js bundle changes behavior **without redeploy**.

---

## Requirements

### R1 — New collection: `static-assets`

Create Payload collection `static-assets`.

Fields (minimum):

- `file` (upload) — for generic assets OR bundle ZIP (see R3)
- `key` (string, required) — stable identifier (e.g., `pdfjs-viewer`, `theme-main-css`)
- `category` (enum, required): `image | svg | font | json | pdf | css | js | bundle | other`
- `status` (enum): `draft | active | archived`
- `version` (string, required)
- `publicUrl` (read-only)
- `contentType` (read-only)
- `checksumSha256` (read-only)
- Audit fields: `createdBy`, `updatedBy`, `activatedBy`, `activatedAt`

### R2 — Storage

- Store uploaded files/bundles to a public CDN-friendly store (prefer Vercel Blob) under a stable prefix:
  - `static-assets/<key>/<version>/...`

- Enforce content-type and safe filenames.

### R3 — Bundles + Manifest (for complex assets like PDF.js)

Support a **bundle** representation:

- Key `pdfjs-viewer` is treated as a bundle.
- Bundle is uploaded as a **ZIP** (recommended) OR as a directory tree if your current uploader supports it.
- On upload, server extracts bundle contents into Blob under the stable prefix.

Manifest approach (choose one, but implement in a way that can be extended):

- **Option A (preferred):** store `manifest` JSON in the `static-assets` record.
- **Option B:** store `manifest.json` alongside files in Blob and keep `manifestPath` on record.

Manifest schema (strict validation required):

- `version: string`
- `paths.viewerHtml: string`
- `paths.viewerMjs: string`
- `paths.viewerCss: string`
- `paths.pdfMjs: string`
- `paths.workerMjs?: string`
- optional `paths.webBase?: string` (if needed for images/fonts)

### R4 — Activation semantics

- Only one `active` asset per `(key, category)`.
- Activating a version auto-archives the previous active.
- Activation must be explicit (no auto-activate on upload).

### R5 — Runtime resolver

Add server-side resolver:

- `getActiveStaticAsset(key)` for single-file assets
- `getActiveStaticBundle(key)` for bundles

Both return:

- `publicUrl/baseUrl`, `version`, `integrity/checksum`, and for bundles: `manifest` or `manifestPath`.

Add short TTL caching (server-side) to avoid DB hits per request.

### R6 — PDF viewer route refactor

Update `src/app/api/pdfjs-viewer/route.ts`:

- No hardcoded PDF.js CDN URLs/hashes.
- Route resolves active bundle: `bundle = getActiveStaticBundle('pdfjs-viewer')`.
- Loads + validates manifest.
- Builds absolute URLs for viewer assets.
- Renders viewer HTML using a **separate template file** with placeholder tokens.
- Uses `logger` (no `console.*`).

### R7 — `file` param security (mandatory)

- Strict allowlist validation for `?file=`:
  - allow same-origin URLs and relative `/...` URLs
  - optionally allow specific storage origins if explicitly configured
  - reject `javascript:`, `data:`, non-http(s), overly long inputs

- No inline script injection.

### R8 — Optional JS/CSS loading (only if enabled)

If you enable runtime JS/CSS:

- Admin-only upload + activate.
- Enforce allowlists for extensions + MIME.
- Provide SRI integrity string from sha256.
- Add/confirm CSP (restrict script-src/style-src; avoid unsafe-inline).
- Never load arbitrary client-selected assets; load only from a controlled config list.

---

## Implementation Stages

## Stage 1 — StaticAssets core

- Implement `static-assets` collection.
- Implement Blob storage path strategy.
- Infer `contentType`, compute `checksumSha256`.
- Admin list/detail UX.

## Stage 2 — Activation workflow

- Implement Activate action/endpoint (admin-only).
- Enforce single-active per `(key, category)`.
- Auto-archive previous active.
- Record `activatedBy/activatedAt`.

## Stage 3 — Bundles + Manifest

- Implement ZIP bundle upload for `category=bundle`.
- Extract and upload extracted files under `static-assets/<key>/<version>/...`.
- Generate or accept manifest:
  - If Option A: store validated manifest JSON in record.
  - If Option B: ensure manifest.json exists in Blob and store manifestPath.

- Seed initial `pdfjs-viewer` bundle and activate.

## Stage 4 — Resolver layer

- Add `getActiveStaticAsset(key)` and `getActiveStaticBundle(key)`.
- Add caching TTL.

## Stage 5 — Refactor `/api/pdfjs-viewer`

- Extract viewer HTML into `src/lib/pdfjs/viewer.template.html` (or route-local) with placeholders.
- Replace hardcoded constants with bundle resolver + manifest-driven URLs.
- Keep iframe-friendly headers and caching centralized.
- Use `logger`.

## Stage 6 — Optional runtime JS/CSS

- Add `runtime-assets-config` (Global) controlling which keys are allowed/loaded and in which order.
- Render tags with SRI + `crossorigin="anonymous"`.
- Add CSP updates if JS enabled.

---

## Tests & Verification

### Unit

- `validateFileUrl()` allowlist + max length.
- Manifest schema validation (good/bad examples).
- Activation logic (single-active enforcement).
- URL builder (`baseUrl + path` correctness).

### Integration

- Route integration test with mocked resolver + mocked fetch of viewer assets.
  - `200`, `Content-Type: text/html`
  - output contains expected `<base href>` and manifest-driven URLs

- Invalid `file` → `400`
- Missing active bundle → `503`
- Upstream fetch failure → `502`

### Manual smoke

- Upload a PDF to Media and render in frontend + admin preview.
- Upload and activate a new `pdfjs-viewer` bundle version; verify it takes effect without redeploy.
- (If enabled) upload CSS asset, activate, and verify it loads and applies.

---

## Guardrails

- No new dependencies.
- Admin-only upload/activate.
- Do not weaken security posture (CSP, allowlists).
- Deterministic behavior + easy rollback (activate previous version).
