
### taskify (2026-04-05T11:33:56)
Based on my investigation, I now have a clear picture of the issue. Let me provide a summary of my findings:

## Investigation Summary

**Root Cause Analysis:**

The issue is that when users upload low-resolution or highly compressed images, they receive a generic "Upload failed" error instead of an actionable message. The problem is in the error handling flow:

1. **Vercel Blob rejection**: Vercel Blob may reject certain images (e.g., corrupted, unprocessable, or images that fail internal valid
...(truncated)

### plan (2026-04-05T11:34:16)
{
  "task_type": "bugfix",
  "title": "Fix image upload error handling with quality constraints",
  "description": "When users upload low-resolution or highly compressed images in the chat, they receive a generic error message instead of an actionable error. The issue is that Vercel Blob may reject certain images, but the error handling doesn't properly surface the specific error to the user. Need to improve error messages and/or add client-side validation for image dimensions before upload.",
 
...(truncated)

### build (2026-04-05T11:36:43)
The implementation is complete. Here's a summary of the changes:

## Changes Made

### 1. `src/server/chat-assets/constants.ts`
Added minimum image dimension constraints:
```typescript
export const CHAT_ASSET_MIN_IMAGE_WIDTH = 100
export const CHAT_ASSET_MIN_IMAGE_HEIGHT = 100
```

### 2. `src/ui/web/chat/hooks/useDirectChatAssetUpload.ts`
- **Added `getImageDimensions()`** - loads image via `Image()` object and returns natural width/height
- **Added `isImageTooSmall()`** - checks if image dimen
...(truncated)
