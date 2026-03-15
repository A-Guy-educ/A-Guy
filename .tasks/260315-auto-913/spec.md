# Spec: 260315-auto-913

## Overview

Bug fix: PDF files fail to open in certain lessons, displaying "Invalid or corrupted PDF file" error in PDF.js viewer.

## Requirements

### FR-001: Correct Content-Type Header for PDFs

**Priority**: MUST
**Description**: Ensure all PDF files served through the media API return `Content-Type: application/pdf` header. PDF.js requires the correct MIME type to parse and render the document. Verify that Vercel Blob correctly preserves the content-type when serving files through Payload's proxy.

### FR-002: CORS Configuration for Vercel Blob

**Priority**: MUST
**Description**: Ensure Vercel Blob storage is configured with proper CORS headers to allow the PDF.js viewer (served from the app domain) to fetch PDF files. The PDF.js viewer runs in an iframe and makes XHR/fetch requests to load the PDF - these requests must be allowed by CORS.

### FR-003: CORS Configuration for PDF.js Viewer

**Priority**: MUST
**Description**: Ensure the PDF.js viewer HTML response includes appropriate CORS headers (`Access-Control-Allow-Origin: *`) to allow cross-origin embedding in iframes.

### FR-004: PDF URL Resolution

**Priority**: MUST
**Description**: Verify that PDF URLs passed to the PDF.js viewer are correctly resolved. The URL should either be:
- A Vercel Blob URL (e.g., `https://*.blob.vercel-storage.com/...`)
- A same-origin URL via Payload's proxy (`/api/media/file/...`)

### FR-005: Graceful Error Handling

**Priority**: SHOULD
**Description**: When PDF loading fails, display a user-friendly error message with retry option instead of showing the raw PDF.js error. The existing implementation already has retry logic with MAX_RETRIES = 3.

### NFR-001: Vercel Blob CORS Configuration

**Priority**: MUST
**Description**: Vercel Blob must be configured with CORS to allow GET requests from the application origin. This is typically configured in the Vercel Blob dashboard or via the API, not in code.

## Acceptance Criteria

- [ ] PDF files with correct Content-Type header (`application/pdf`) load successfully in the PDF.js viewer
- [ ] Vercel Blob CORS configuration allows GET requests from the application domain
- [ ] PDF.js viewer HTML includes `Access-Control-Allow-Origin: *` header
- [ ] PDF URLs passed to the viewer are valid and accessible
- [ ] Error state displays when PDF fails to load with retry functionality (existing)
- [ ] No "Invalid or corrupted PDF file" errors for valid PDFs

## Guardrails

- Must not break existing image/video/media functionality
- Must maintain backward compatibility with existing media URLs
- Must not introduce security vulnerabilities in URL validation

## Out of Scope

- Fixing corrupted PDF files in storage (data issue, not code)
- General PDF.js viewer customization beyond fixing the loading issue
- Changes to the PDF upload process
