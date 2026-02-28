# Plan: ExerciseAssets Vercel Blob Migration

## Rerun Context

This is a rerun. Previous plan likely had implementation issues. The spec requires:
1. Remove `staticDir: 'exercise-assets'` (local filesystem - breaks in serverless)
2. Fix `adminThumbnail: 'thumbnail'` (references non-existent image size)
3. Follow Media collection pattern for Vercel Blob configuration

## Bug Summary

**Root Cause**: ExerciseAssets collection uses local filesystem storage (`staticDir`) which doesn't persist in serverless environments, and `adminThumbnail` references a non-existent 'thumbnail' size (imageSizes are commented out).

**Files Affected**:
- `src/server/payload/collections/ExerciseAssets.ts`

---

## Step 1: Migrate ExerciseAssets to Vercel Blob Storage

**Files to Touch**:

- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED - lines 14-39)

**Reproduction Test**:

- Test location: `tests/int/exercise-assets-upload.int.spec.ts` (NEW)
- Test: `should store files in Vercel Blob, not local filesystem`
- Why it fails: Currently uses `staticDir: 'exercise-assets'` - local storage

**Fix**: Remove `staticDir` from upload config, add Vercel Blob configuration following Media pattern:

```typescript
upload: {
  // Vercel Blob storage plugin handles actual file storage
  // Remove staticDir - the plugin handles storage automatically
  adminThumbnail: ({ doc }) => {
    // Return the URL directly since imageSizes are disabled
    const docData = doc as { url?: string }
    return docData.url || false
  },
  mimeTypes: ['image/svg+xml', 'image/png'],
  // Allow restricted file types (SVG can have issues with sharp)
  allowRestrictedFileTypes: true,
},
```

**Verification**:

- Run reproduction test → Should pass (files stored in blob)
- Verify upload config doesn't include `staticDir`

---

## Step 2: Fix adminThumbnail Configuration

**Root Cause**: `adminThumbnail: 'thumbnail'` references an imageSize that doesn't exist (imageSizes are commented out).

**Files to Touch**:

- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED - line 37)

**Reproduction Test**:

- Test location: `tests/int/exercise-assets-upload.int.spec.ts` (NEW)
- Test: `should return valid thumbnail URL for uploaded file`
- Why it fails: Current config returns false/undefined because 'thumbnail' size doesn't exist

**Fix**: Change `adminThumbnail` from string `'thumbnail'` to function that returns URL directly:

```typescript
adminThumbnail: ({ doc }) => {
  const docData = doc as { url?: string }
  return docData.url || false
},
```

**Verification**:

- Run reproduction test → Should pass (returns valid URL)
- Check admin panel shows thumbnails correctly

---

## Step 3: Generate Types and Verify Build

**Files to Touch**:

- Run `pnpm generate:types`

**Reproduction Test**:

- Test: `TypeScript compilation passes`
- Why it fails: Types may be stale after config changes

**Fix**: Run type generation

**Verification**:

- `pnpm tsc --noEmit` → Must pass

---

## Acceptance Criteria

- [ ] ExerciseAssets collection uses Vercel Blob adapter (no `staticDir`)
- [ ] Configuration follows Media collection pattern
- [ ] Files are stored in Vercel Blob storage
- [ ] `adminThumbnail` returns valid URL or false
- [ ] TypeScript compiles without errors
- [ ] Existing mimeTypes restriction preserved (`image/svg+xml`, `image/png`)
