# Gap Analysis: 260228-auto-74

## Summary

- Gaps Found: 2
- Spec Revised: Yes

## Gaps Found

### Gap 1: adminThumbnail references non-existent image size

**Severity:** High
**Location:** `src/server/payload/collections/ExerciseAssets.ts` - line 37
**Issue:** The current configuration has `adminThumbnail: 'thumbnail'` but `imageSizes` are commented out (lines 16-36). This means the thumbnail size doesn't exist, so the admin panel won't be able to display preview images. This is a related issue that must be fixed during the migration.

**Fix Applied:** Added explicit mention in spec that adminThumbnail needs to be fixed. The Media collection uses a function for adminThumbnail (lines 32-56 in Media/index.ts) to handle different media types. For ExerciseAssets (which only handles SVG and PNG), a simpler solution is needed - either return the URL directly or use `false` to disable thumbnail.

### Gap 2: Missing filesRequiredOnCreate configuration

**Severity:** Medium
**Location:** `src/server/payload/collections/ExerciseAssets.ts` - upload config
**Issue:** The Media collection has `filesRequiredOnCreate: false` in its upload config (line 28 in Media/index.ts). This allows creating document records without requiring an immediate file upload. The spec should mention whether ExerciseAssets needs this flexibility. Looking at the current ExerciseAssets, it seems files are always uploaded, so this may not be needed, but it's worth noting.

**Fix Applied:** Added as Implementation Note in spec - the upload config should follow Media's pattern including other upload-related settings if needed.

## Changes Made to Spec

- Updated FR-2 to explicitly mention fixing the adminThumbnail configuration (not just following the pattern)
- Added Implementation Note about removing staticDir and ensuring adminThumbnail works correctly
- Added note that Vercel Blob plugin already has exercise-assets configured in plugins/index.ts

## No Additional Gaps Found

After thorough analysis:
- The Vercel Blob plugin is already configured to handle `exercise-assets` (verified in `src/server/payload/plugins/index.ts` line 55)
- The main fix (removing staticDir) is correctly identified in the spec
- Migration of existing files is not a concern - the plugin handles new uploads to blob storage automatically; existing local files would need manual migration if needed, but this is beyond scope of config change

The spec is now complete and aligned with codebase patterns.
