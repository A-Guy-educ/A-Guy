# ExerciseAssets Vercel Blob Migration Spec

## Overview
Migrate the `ExerciseAssets` collection from local filesystem storage to Vercel Blob storage to ensure file persistence across serverless deployments.

## Problem
The `ExerciseAssets` collection currently uses `upload: { staticDir: 'exercise-assets' }` which stores files on the local filesystem. This approach fails in serverless environments because files are not persisted across function invocations.

## Requirements
- FR-1: Migrate ExerciseAssets collection to use Vercel Blob adapter
- FR-2: Follow the same pattern as the Media collection
- FR-3: Ensure existing files are handled (migration strategy if needed)
- FR-4: Verify the configuration works with serverless deployment

## Acceptance Criteria
- [ ] ExerciseAssets collection uses Vercel Blob adapter instead of staticDir
- [ ] Configuration follows the same pattern as Media collection
- [ ] Files are stored in Vercel Blob storage
- [ ] No data loss during deployment

## Implementation Notes
- Reference `src/server/payload/collections/Media.ts` for Vercel Blob configuration pattern
- The upload configuration should use `vercelBlob` adapter
- Bucket name should be consistent with project conventions
