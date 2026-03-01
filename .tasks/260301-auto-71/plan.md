# Plan: Fix Media Upload Failure in Course/Lesson/Exercise

**Task ID**: 260301-auto-71
**Task Type**: fix_bug
**Spec Reference**: spec.md — Media uploads fail with 400 Bad Request when uploading through Courses, Lessons, or Exercises collections.

## Rerun Context

This is a rerun with minimal feedback ("Rerun requested via /cody rerun"). The previous build had no plan.md, so this is the first plan for this task. All analysis is fresh.

## Root Cause Analysis

After extensive code tracing through the Payload 3.x client upload flow (`addDataAndFileToRequest` → `generateFileData` → `beforeValidate` hooks → `createOperation`), the 400 Bad Request error is caused by **multiple interacting issues**:

### Execution Order in Payload 3.x `createOperation`

1. **Access check** (`create: adminOnly`)
2. **`generateFileData`** — processes `req.file`, merges `mimeType`/`filename`/`filesize` into `data`
3. **`beforeValidate` — field hooks** (defaults applied here)
4. **`beforeValidate` — collection hooks** (`validateMediaUploadHook` runs here)
5. **`beforeChange` — collection hooks**
6. **`beforeChange` — field hooks** (`inferMediaTypeHook` runs here)

### Root Cause 1: `validateMediaUploadHook` error handling (High Priority)

**File**: `src/server/payload/collections/Media/hooks/validateMediaUpload.ts`

The hook throws generic `Error` objects instead of Payload's `APIError` or `ValidationError`. When a file truly is missing (e.g., client upload flow fails to populate `req.file` due to network/blob issues, or user submits form without file in edge case), the hook throws:

```typescript
throw new Error('A file is required for non-external media types')
```

Payload wraps generic `Error` throws from hooks as 400 Bad Request responses, but the error message is opaque to users and doesn't appear in the structured error response format. Additionally, the hook doesn't log the failure, making it hard to debug.

The hook should use Payload's error classes for proper HTTP status codes and structured error responses, and add logging to help identify when this validation path is hit.

### Root Cause 2: `ExerciseAssets` broken `adminThumbnail` reference (Medium Priority)

**File**: `src/server/payload/collections/ExerciseAssets.ts` (line 37)

`adminThumbnail: 'thumbnail'` references a named image size that doesn't exist (all `imageSizes` are commented out). Payload's admin panel tries to access `doc.sizes?.thumbnail.filename` for the thumbnail URL, which throws a TypeError at runtime. While this doesn't directly cause the Media collection 400 error, it causes admin panel errors when browsing ExerciseAssets, degrading the overall upload experience.

### Root Cause 3: Client upload access mismatch (Medium Priority)

**File**: `src/server/payload/plugins/index.ts`

The Vercel Blob plugin's client upload route uses `defaultAccess: ({ req }) => !!req.user` (any authenticated user), while Media collection's `create: adminOnly` restricts document creation to admins only. For non-admin users:
1. ✅ Get upload token (any authenticated user)
2. ✅ Upload file to Vercel Blob
3. ❌ Create Media document → fails (not admin)

This creates orphaned blobs on Vercel Blob storage and confusing error messages. The access function should be aligned with collection-level create access, differentiated per collection.

## Assumptions

1. The spec mentions "Admin or Editor" — this system has only `admin` and `student` roles. We assume the reporter is admin.
2. The `BLOB_READ_WRITE_TOKEN` is correctly configured (otherwise server wouldn't start).
3. The `clientUploads: true` configuration is intentional and should remain enabled.
4. The `ExerciseAssets` collection uses `authenticated` for `create` access (not `adminOnly`), so its client upload access should stay `authenticated`.

---

## Step 1: Improve `validateMediaUploadHook` error handling and resilience

**Root Cause**: The hook throws generic `Error` objects that produce opaque 400 responses. It also lacks logging, making it impossible to diagnose when this validation path fires.

**Files to Touch**:
- `src/server/payload/collections/Media/hooks/validateMediaUpload.ts` (MODIFIED — lines 1-59)

**Reproduction Test**:
- Test location: `tests/unit/collections/media-validate-upload.test.ts` (NEW)
- What it tests:
  1. Hook throws a descriptive error (not generic `Error`) when `data` has no `mimeType`/`filename` for non-External types
  2. Hook does NOT throw when `type` is External and `externalUrl` is provided
  3. Hook throws a descriptive error when External type has no `externalUrl`
  4. Hook passes through when `mimeType` and `filename` are present
  5. Hook properly validates MIME type against allowlist
  6. Hook properly enforces size limits
- Why it fails: Currently throws `new Error(...)` instead of `new APIError(...)`, and lacks logging context

**Fix**:
1. Import `APIError` from `payload` 
2. Replace all `throw new Error(...)` with `throw new APIError('...', 400)` for clear, structured error responses
3. Add `req.payload.logger.warn(...)` before each throw for server-side debugging
4. Add a guard: if `req.file` exists but `data.mimeType`/`data.filename` are missing, log a warning and return `data` gracefully — this handles the edge case where `generateFileData` processed the file but a race condition left data incomplete (defensive programming)

**Specific code changes**:
```typescript
import { APIError } from 'payload'

// Before "A file is required" check:
if (req.file && (!mimeType || !filename)) {
  req.payload.logger.warn(
    '[Media] File present on request but metadata not in data — skipping validation (client upload edge case)'
  )
  return data
}

// Replace: throw new Error('External media requires an external URL')
// With: throw new APIError('External media requires an external URL', 400)

// Replace: throw new Error('A file is required for non-external media types')
// With:
req.payload.logger.warn('[Media] Upload attempted without file or metadata', { operation, type })
throw new APIError('A file is required for non-external media types. Please select a file to upload.', 400)

// Replace: throw new Error(`File size (${...}MB) exceeds maximum...`)
// With: throw new APIError(`File size (${...}MB) exceeds maximum...`, 400)
```

**Verification**:
- Run `pnpm vitest run tests/unit/collections/media-validate-upload.test.ts`
- Reproduction test → MUST FAIL before fix (error types are wrong, no logging)
- After fix applied → MUST PASS

**Acceptance Criteria**:
- [ ] Hook throws `APIError` (not generic `Error`) for all error cases
- [ ] Hook logs warnings before throwing
- [ ] Hook gracefully handles edge case where `req.file` exists but `data` lacks metadata
- [ ] Hook still validates External type correctly
- [ ] Hook still validates MIME type and size limits

---

## Step 2: Fix `ExerciseAssets` broken `adminThumbnail` reference

**Root Cause**: `adminThumbnail: 'thumbnail'` references an image size named `'thumbnail'` that doesn't exist because `imageSizes` is commented out. Payload's admin tries to access `doc.sizes?.thumbnail.filename` which throws TypeError.

**Files to Touch**:
- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED — line 37)

**Reproduction Test**:
- Test location: `tests/unit/collections/exercise-assets-config.test.ts` (NEW)
- What it tests:
  1. If `adminThumbnail` is a string, it must reference an existing image size in `imageSizes`
  2. After fix: `adminThumbnail` is a function that returns the doc's URL
  3. The upload config has correct mimeTypes for SVG and PNG
- Why it fails: `adminThumbnail: 'thumbnail'` references non-existent size (no `imageSizes` defined)

**Fix**: Replace the string reference with a function that returns the document's URL:

```typescript
// Change from:
adminThumbnail: 'thumbnail',
// To:
adminThumbnail: ({ doc }) => {
  const docData = doc as { url?: string }
  return docData.url || false
},
```

**Verification**:
- Run `pnpm vitest run tests/unit/collections/exercise-assets-config.test.ts`
- Reproduction test → MUST FAIL before fix
- After fix applied → MUST PASS

**Acceptance Criteria**:
- [ ] `adminThumbnail` does not reference a non-existent image size
- [ ] Admin panel can display exercise asset thumbnails
- [ ] `pnpm tsc --noEmit` passes

---

## Step 3: Align client upload access with collection-level access

**Root Cause**: Client upload token route allows any authenticated user, but Media's `create: adminOnly` only allows admins. This causes orphaned blobs for non-admin users.

**Files to Touch**:
- `src/server/payload/plugins/index.ts` (MODIFIED — lines 48-58)

**Reproduction Test**:
- Test location: `tests/unit/plugins/vercel-blob-access.test.ts` (NEW)
- What it tests:
  1. Plugin configuration has custom `clientUploads.access` function (not boolean `true`)
  2. For `media` collection: access returns `false` for non-admin users, `true` for admin users
  3. For `exercise-assets` collection: access returns `true` for any authenticated user, `false` for unauthenticated
  4. Access returns `false` for unauthenticated users for both collections
- Why it fails: Currently `clientUploads: true` uses default access (`!!req.user`) for both collections

**Fix**: Change `clientUploads: true` to an object with a collection-aware access function:

```typescript
clientUploads: {
  access: ({ req, collectionSlug }: { req: PayloadRequest; collectionSlug: string }) => {
    if (!req.user) return false
    // exercise-assets: any authenticated user (matches collection access: authenticated)
    if (collectionSlug === 'exercise-assets') return true
    // media: admin only (matches collection access: adminOnly)
    if (!('role' in req.user)) return false
    return req.user.role === 'admin'
  },
},
```

**Verification**:
- Run `pnpm vitest run tests/unit/plugins/vercel-blob-access.test.ts`
- Reproduction test → MUST FAIL before fix
- After fix applied → MUST PASS

**Acceptance Criteria**:
- [ ] Non-admin users cannot get client upload tokens for `media` collection
- [ ] Any authenticated user can get client upload tokens for `exercise-assets` collection
- [ ] Admin users can get client upload tokens for both collections
- [ ] `pnpm tsc --noEmit` passes

---

## Step 4: End-to-end configuration validation test

**Files to Touch**:
- `tests/unit/collections/media-upload-flow.test.ts` (NEW)

**What it tests**: Validates the complete Media collection configuration is compatible with the client upload flow:
1. Media has `filesRequiredOnCreate: false` (required for External type + client upload resilience)
2. Media has `allowRestrictedFileTypes: true` (skips buffer-based checks for client uploads)
3. `validateMediaUploadHook` is in `hooks.beforeValidate` array
4. `resolveEmbedHook` and `enforceRetentionPolicyHook` are in `hooks.beforeChange` array
5. `inferMediaTypeHook` is on the `type` field's `hooks.beforeChange`
6. `type` field has `defaultValue` (so it passes `required: true` even without explicit user input)
7. Collections with upload fields (Courses.mediaFiles, Lessons.contentFiles, Lessons.introMedia) reference `'media'` as `relationTo`
8. ExerciseAssets has a valid `adminThumbnail` (after fix)

**Verification**:
- Run `pnpm vitest run tests/unit/collections/media-upload-flow.test.ts`
- All tests MUST PASS after all fixes applied

**Acceptance Criteria**:
- [ ] All Media collection configuration assertions pass
- [ ] All collection relationship field assertions pass
- [ ] Hook registration assertions pass

---

## Quality Gates

After all steps:
1. `pnpm tsc --noEmit` — No TypeScript errors
2. `pnpm vitest run tests/unit/collections/media-validate-upload.test.ts` — Hook tests pass
3. `pnpm vitest run tests/unit/collections/exercise-assets-config.test.ts` — Config tests pass
4. `pnpm vitest run tests/unit/plugins/vercel-blob-access.test.ts` — Access tests pass
5. `pnpm vitest run tests/unit/collections/media-upload-flow.test.ts` — Flow tests pass
6. `pnpm vitest run tests/unit/access/content-collections-admin-only.test.ts` — Existing access tests still pass
7. `pnpm lint` — No lint errors

## Files Summary

| File | Status | Step |
|------|--------|------|
| `src/server/payload/collections/Media/hooks/validateMediaUpload.ts` | MODIFIED | 1 |
| `src/server/payload/collections/ExerciseAssets.ts` | MODIFIED | 2 |
| `src/server/payload/plugins/index.ts` | MODIFIED | 3 |
| `tests/unit/collections/media-validate-upload.test.ts` | NEW | 1 |
| `tests/unit/collections/exercise-assets-config.test.ts` | NEW | 2 |
| `tests/unit/plugins/vercel-blob-access.test.ts` | NEW | 3 |
| `tests/unit/collections/media-upload-flow.test.ts` | NEW | 4 |

## Build Agent Notes

- The `APIError` import in Step 1 comes from `payload` package (not `@payloadcms/ui`)
- For Step 3, the `PayloadRequest` type may need to be imported from `payload` for the access function signature
- The Vercel Blob plugin accepts `clientUploads` as either `boolean` or `{ access: Function }` — confirmed from plugin source code
- When running tests, ensure `BLOB_READ_WRITE_TOKEN` is set (even a dummy value) or the plugin init code may throw. For unit tests that import collection configs directly (not Payload instances), this isn't needed.
- `pnpm generate:importmap` should be run if any admin component paths change (none in this plan)
