# Build Agent Report: fix-ci-test-timeouts

## Changes

### Core Fix - Payload Plugin (src/server/payload/plugins/index.ts)
- Modified Vercel Blob plugin initialization to properly handle invalid/mock tokens in test mode
- Added validation to check if token starts with 'vercel_blob_rw_' (valid Vercel Blob token format)
- In test mode, if token is missing or invalid, the plugin is skipped entirely rather than failing

### Test Files Fixed

1. **tests/int/vercel-blob-adapter.int.spec.ts**
   - Added proper test skipping using `it.skip` with early return when token is invalid
   - Updated isSkipped check to also validate token prefix: `!token.startsWith('vercel_blob_rw_')`

2. **tests/int/media-upload-flow.int.spec.ts**
   - Added proper test skipping with `it.skip` when blob token is missing/invalid
   - Updated isSkipped check to validate token format

3. **tests/int/chat-asset-upload.int.spec.ts**
   - Added proper test skipping when BLOB_READ_WRITE_TOKEN is missing/invalid
   - Added validation for token format (must start with 'vercel_blob_rw_')

4. **tests/int/v3-conversion-pipeline.int.spec.ts**
   - Added extended timeout (180000ms) to afterAll hook for cleanup operations that may take longer during parallel test runs

## Tests Written

No new tests were written — this was a fix for existing test infrastructure.

## Deviations

- None — plan followed exactly

## Quality

- TypeScript: PASS

## Root Cause Analysis

The CI failures were caused by:
1. Invalid BLOB_READ_WRITE_TOKEN ('mock-token-for-testing') being passed to Payload config
2. The Vercel Blob storage plugin was initializing with this invalid token and failing at the client level
3. Tests were timing out because they were waiting for the invalid blob operations to complete

The fix ensures that:
- In test mode (NODE_ENV=test), invalid tokens are handled gracefully by skipping the Vercel Blob plugin entirely
- Tests that require actual blob storage properly skip when no valid token is available
- Long-running cleanup operations have extended timeouts
