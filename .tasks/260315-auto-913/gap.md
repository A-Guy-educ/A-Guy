# Gap Analysis: 260315-auto-913

## Summary

- Gaps Found: 2
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Vercel Blob CORS Configuration Requirement

**Severity:** Critical
**Location:** Vercel Blob storage configuration (external, not in codebase)
**Issue:** The spec originally mentioned "CORS headers" but didn't specify that Vercel Blob itself needs CORS configuration. When PDF.js fetches the PDF file from Vercel Blob, the browser makes a cross-origin request. Without proper CORS configuration on Vercel Blob, the browser will block the request, causing PDF.js to fail with "Invalid or corrupted PDF file" error (because it receives a CORS error response instead of the PDF).
**Fix Applied:** Added FR-002 explicitly for Vercel Blob CORS configuration, and added NFR-001 to document the requirement for Vercel Blob CORS settings.

### Gap 2: Incomplete CORS Requirements for PDF.js Viewer

**Severity:** High
**Location:** `/src/infra/pdfjs/config.ts` (RESPONSE_HEADERS)
**Issue:** The existing code already includes `Access-Control-Allow-Origin: '*'` in RESPONSE_HEADERS for the viewer HTML. However, the spec didn't explicitly call out that this header is already present, and it didn't distinguish between CORS for the viewer HTML vs. CORS for the PDF file itself.
**Fix Applied:** Split FR-002 into two separate requirements:
- FR-002: Vercel Blob CORS (for the PDF file)
- FR-003: PDF.js Viewer CORS (for the HTML viewer)

## Changes Made to Spec

- Added FR-002: CORS Configuration for Vercel Blob (NEW)
- Renamed old FR-002 to FR-003: CORS Configuration for PDF.js Viewer
- Added NFR-001: Vercel Blob CORS Configuration - documenting that CORS must be configured in Vercel Blob dashboard
- Updated Acceptance Criteria to include Vercel Blob CORS verification

## Root Cause Analysis

Based on code exploration, the most likely cause of the "Invalid or corrupted PDF file" error is:

1. **Vercel Blob CORS not configured**: When the PDF.js viewer tries to fetch the PDF from Vercel Blob storage, the browser blocks the request due to missing CORS headers on the blob response. PDF.js receives a CORS error or empty response, which it interprets as an invalid/corrupted PDF.

2. **Evidence**: 
   - The PDF.js viewer is served from the app domain (`/api/pdfjs-viewer`)
   - The PDF is served from Vercel Blob (`*.blob.vercel-storage.com`)
   - This is a cross-origin request that requires CORS
   - The error "Invalid PDF structure" is what PDF.js shows when it receives an unexpected response

3. **The fix requires**: Configuring CORS on Vercel Blob storage to allow GET requests from the application origin. This is done in the Vercel dashboard or via Vercel Blob API, not in code.

## No Code Changes Required

This bug does not require code changes. The fix is a configuration change in Vercel Blob storage settings to add CORS rules.
