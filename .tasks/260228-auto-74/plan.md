# ExerciseAssets Vercel Blob Migration Plan

## Rerun Context

This is a rerun of a previous fix attempt. The task is to migrate the ExerciseAssets collection from local filesystem storage to Vercel Blob storage. Key issues to address:
- Remove deprecated `staticDir` configuration
- Fix broken `adminThumbnail` that references non-existent 'thumbnail' size

---

## Bug Summary

**Root Cause**: The ExerciseAssets collection uses local filesystem storage (`staticDir: 'exercise-assets'`) which doesn't persist in serverless environments. Additionally, `adminThumbnail: 'thumbnail'` references an image size that is commented out, causing the thumbnail to not display in the admin panel.

**Files Affected**:
- `src/server/payload/collections/ExerciseAssets.ts`

---

## Step 1: Migrate ExerciseAssets to Vercel Blob Storage

**Root Cause**: Using local filesystem storage (`staticDir`) fails in serverless environments because files are not persisted across function invocations.

**Files to Touch**:
- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED - lines 14-39)

**Reproduction Test**: 
- Verify ExerciseAssets.ts contains `staticDir: 'exercise-assets'` (will be removed in fix)

**Fix**: 
1. Remove `staticDir: 'exercise-assets'` from upload config - the Vercel Blob plugin handles storage automatically
2. Change `adminThumbnail: 'thumbnail'` to a function that returns `doc.url || false` (similar to Media collection pattern)
3. Keep `mimeTypes: ['image/svg+xml', 'image/png']` restriction

**Verification**:
1. Run `pnpm tsc --noEmit` to validate TypeScript compiles
2. Verify ExerciseAssets.ts no longer contains `staticDir`
3. Verify adminThumbnail is now a function returning `doc.url || false`
4. Run `pnpm generate:types` to regenerate Payload types (required after collection changes)

---

## Implementation Details

### Changes to ExerciseAssets.ts

```typescript
// BEFORE (lines 14-39):
upload: {
  staticDir: 'exercise-assets',
  // imageSizes commented out...
  adminThumbnail: 'thumbnail',
  mimeTypes: ['image/svg+xml', 'image/png'],
}

// AFTER:
upload: {
  // Vercel Blob storage plugin handles actual file storage
  // Plugin injects disableLocalStorage: true and adapter handlers
  // Show thumbnail in admin list view - returns URL or false
  adminThumbnail: ({ doc }) => {
    const docData = doc as { url?: string }
    return docData.url || false
  },
  mimeTypes: ['image/svg+xml', 'image/png'],
}
```

---

## Acceptance Criteria

- [ ] ExerciseAssets collection uses Vercel Blob adapter (no staticDir)
- [ ] Configuration follows the same pattern as Media collection
- [ ] adminThumbnail works correctly (returns URL or false)
- [ ] Files will be stored in Vercel Blob storage
- [ ] No data loss during deployment
- [ ] TypeScript compiles without errors (`pnpm tsc --noEmit`)
- [ ] Payload types generated (`pnpm generate:types`)
