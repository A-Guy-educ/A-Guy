# ExerciseAssets Vercel Blob Migration Spec

## Overview
Migrate the `ExerciseAssets` collection from local filesystem storage to Vercel Blob storage to ensure file persistence across serverless deployments.

## Problem
The `ExerciseAssets` collection currently uses `upload: { staticDir: 'exercise-assets' }` which stores files on the local filesystem. This approach fails in serverless environments because files are not persisted across function invocations.

## Requirements
- FR-1: Migrate ExerciseAssets collection to use Vercel Blob adapter
- FR-2: Follow the same pattern as the Media collection, including fixing adminThumbnail
- FR-3: Ensure existing files are handled (migration strategy if needed)
- FR-4: Verify the configuration works with serverless deployment
- FR-5: Fix adminThumbnail configuration (currently references non-existent thumbnail size)

## Acceptance Criteria
- [ ] ExerciseAssets collection uses Vercel Blob adapter instead of staticDir
- [ ] Configuration follows the same pattern as Media collection
- [ ] Files are stored in Vercel Blob storage
- [ ] No data loss during deployment
- [ ] adminThumbnail works correctly in admin panel (currently broken - references 'thumbnail' size that doesn't exist)

## Implementation Notes
- Reference `src/server/payload/collections/Media/index.ts` for Vercel Blob configuration pattern
- The Vercel Blob plugin already has 'exercise-assets' configured in `src/server/payload/plugins/index.ts` (line 55)
- Remove `staticDir: 'exercise-assets'` from upload config - the plugin handles storage automatically
- Fix `adminThumbnail`: The current `'thumbnail'` reference won't work because imageSizes are commented out. Either return URL directly or use `false` to disable
- Keep `mimeTypes: ['image/svg+xml', 'image/png']` restriction for file type validation
- The Media collection pattern for adminThumbnail uses a function (lines 32-56 in Media/index.ts) to handle different media types
