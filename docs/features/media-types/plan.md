# Media Type Enum Implementation Plan

## Overview

Add comprehensive media type categorization to the Media collection with:

- Auto-inference from MIME types with **admin override** capability
- Type-specific admin UI previews (PDF viewer, audio player, video player, etc.)
- Type-specific frontend rendering components
- Strict upload validation with MIME type allowlists per type
- Minimal metadata for MVP (defer rich metadata until after end-to-end works)

**Supported Types**: `image | video | audio | pdf | svg | document | external | other`

---

## Key Changes from Original Plan

### 1. Media Type Updates
- **Removed**: `animation` as top-level type (GIFs treated as `image`, animated content as `video`)
- **Added**:
  - `document` - Word docs, Excel, PowerPoint, text files
  - `external` - External URLs, embeds (no file upload)
  - `other` - Unrecognized MIME types (download-only fallback)

### 2. Override Policy
- **Default**: Auto-inference from MIME type (hook runs on upload)
- **Admin override**: Admin users can manually change type field (read-only for non-admin)
- **Logic**: If admin sets type manually, that value takes precedence over inference

### 3. Unrecognized MIME Handling
- **No "warn but allow"**: Unrecognized MIME types are **forced to `other`**
- **Behavior**: `other` type has strict download-only UI (filename, size, download link)
- **Logging**: Server-side warning logged for unrecognized types

### 4. Validation Rules
- **MIME allowlist per type**: Each type has explicit allowed MIME types
- **Size limits per type**: Enforced on upload
- **Mismatch handling**: If inferred type doesn't match MIME allowlist → **downgrade to `other`** (safer than reject)

### 5. Scope Reduction (MVP)
- **Defer**: Zod schemas, TypeScript guards, rich metadata (codec, bitrate, pageCount)
- **Keep**: Basic type field, minimal metadata, upload validation, preview components
- **Rationale**: Get end-to-end working first, then enhance

### 6. Legacy Migration
- **Read/render time**: Infer from `mimeType` if `type` is missing
- **Backfill**: Optional one-off script later (not required for MVP)

---

## Architecture Summary

### Type Inference with Admin Override

1. **On Upload** (beforeChange hook):
   - Hook infers type from MIME type
   - If admin has manually set `type`, use admin value
   - If MIME type not recognized → force to `other`
   - Validate MIME type against allowlist for inferred type → downgrade to `other` if mismatch

2. **In Admin UI**:
   - Type field is **read-only for non-admin users**
   - Type field is **editable for admin users**
   - Shows inferred type by default

3. **On Read**:
   - If `type` is null/undefined → infer from `mimeType` (legacy support)

### File Structure

```
src/
├── lib/media/
│   ├── types.ts                    # MediaType enum & MIME allowlists
│   └── inferMediaType.ts           # Type inference logic
├── collections/Media/
│   └── hooks/
│       ├── inferMediaType.ts       # beforeChange hook (with admin override)
│       └── validateMediaUpload.ts  # beforeValidate hook (strict validation)
├── components/admin/MediaPreview/
│   ├── index.tsx                   # Dispatcher component
│   ├── ImagePreview.tsx
│   ├── VideoPreview.tsx
│   ├── AudioPreview.tsx
│   ├── PDFPreview.tsx
│   ├── SVGPreview.tsx
│   ├── DocumentPreview.tsx
│   ├── ExternalPreview.tsx
│   └── OtherPreview.tsx
└── components/Media/
    ├── index.tsx                   # Updated dispatcher (MODIFY)
    ├── AudioMedia/index.tsx
    ├── PDFMedia/index.tsx
    ├── SVGMedia/index.tsx
    ├── DocumentMedia/index.tsx
    ├── ExternalMedia/index.tsx
    └── OtherMedia/index.tsx
```

**Total**: ~16 new files, 2 modified files

---

## Critical Files

### 1. [src/lib/media/types.ts](src/lib/media/types.ts)
**Purpose**: Core type definitions - MediaType enum, MIME allowlists

**Key Contents**:
```typescript
export enum MediaType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  PDF = 'pdf',
  SVG = 'svg',
  Document = 'document',
  External = 'external',
  Other = 'other',
}

// MIME type allowlists per type
export const MIME_ALLOWLISTS: Record<MediaType, string[]> = {
  [MediaType.Image]: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/avif', 'image/heic', 'image/heif', 'image/gif'
  ],
  [MediaType.Video]: [
    'video/mp4', 'video/webm', 'video/quicktime',
    'video/x-msvideo', 'video/avi'
  ],
  [MediaType.Audio]: [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
    'audio/m4a', 'audio/x-m4a', 'audio/aac'
  ],
  [MediaType.PDF]: ['application/pdf'],
  [MediaType.SVG]: ['image/svg+xml'],
  [MediaType.Document]: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ],
  [MediaType.External]: [], // No file upload
  [MediaType.Other]: [], // Catch-all
}

// Size limits (bytes)
export const SIZE_LIMITS: Record<MediaType, number> = {
  [MediaType.Image]: 10 * 1024 * 1024, // 10MB
  [MediaType.Video]: 100 * 1024 * 1024, // 100MB
  [MediaType.Audio]: 50 * 1024 * 1024, // 50MB
  [MediaType.PDF]: 20 * 1024 * 1024, // 20MB
  [MediaType.SVG]: 2 * 1024 * 1024, // 2MB
  [MediaType.Document]: 20 * 1024 * 1024, // 20MB
  [MediaType.External]: 0, // No file
  [MediaType.Other]: 50 * 1024 * 1024, // 50MB fallback
}
```

### 2. [src/lib/media/inferMediaType.ts](src/lib/media/inferMediaType.ts)
**Purpose**: Type inference logic with MIME allowlist validation

**Key Functions**:
```typescript
/**
 * Infer MediaType from MIME type
 * Returns 'other' for unrecognized MIME types
 */
export function inferMediaType(
  mimeType: string | null | undefined,
  filename?: string | null
): MediaType {
  if (!mimeType) return MediaType.Other

  const normalized = mimeType.toLowerCase().trim()

  // Check each type's allowlist
  for (const [type, allowlist] of Object.entries(MIME_ALLOWLISTS)) {
    if (allowlist.includes(normalized)) {
      return type as MediaType
    }
  }

  // Prefix fallback for variants
  if (normalized.startsWith('image/')) return MediaType.Image
  if (normalized.startsWith('video/')) return MediaType.Video
  if (normalized.startsWith('audio/')) return MediaType.Audio

  // Unrecognized → other
  return MediaType.Other
}

/**
 * Validate MIME type against allowlist for a given type
 */
export function validateMimeType(
  mimeType: string,
  mediaType: MediaType
): boolean {
  const allowlist = MIME_ALLOWLISTS[mediaType]
  return allowlist.includes(mimeType.toLowerCase().trim())
}
```

### 3. [src/collections/Media.ts](src/collections/Media.ts) (MODIFY)
**Purpose**: Collection schema with type field and conditional access

**Changes**:
1. Add `type` field:
   - Select field with 8 options
   - **Conditional read-only**: Read-only for non-admin, editable for admin
   - Auto-populated via hook (with admin override)

2. Add `externalUrl` field (conditional on `type === 'external'`):
   - Text field for external URLs/embeds
   - Required when type is external
   - Hidden for other types

3. Make `alt` field conditional (required only for image and SVG)

4. Add `beforeChange` hook on `type` field (with admin override logic)

5. Add `beforeValidate` hook at collection level (strict validation)

**Schema Snippet**:
```typescript
fields: [
  {
    name: 'type',
    type: 'select',
    options: [
      { label: 'Image', value: MediaType.Image },
      { label: 'Video', value: MediaType.Video },
      { label: 'Audio', value: MediaType.Audio },
      { label: 'PDF', value: MediaType.PDF },
      { label: 'SVG', value: MediaType.SVG },
      { label: 'Document', value: MediaType.Document },
      { label: 'External', value: MediaType.External },
      { label: 'Other', value: MediaType.Other },
    ],
    admin: {
      position: 'sidebar',
      description: 'Auto-detected from file type (admin can override)',
      readOnly: ({ req }) => {
        // Editable for admin, read-only for others
        return !req.user || req.user.role !== 'admin'
      },
    },
    hooks: {
      beforeChange: [inferMediaTypeHook],
    },
    required: true,
    defaultValue: MediaType.Other,
  },
  {
    name: 'externalUrl',
    type: 'text',
    admin: {
      condition: (data) => data?.type === MediaType.External,
      description: 'URL for external embed or link',
    },
    required: false,
  },
  {
    name: 'alt',
    type: 'text',
    admin: {
      condition: (data) => ['image', 'svg'].includes(data?.type),
    },
  },
  // ... other fields
]
```

### 4. [src/collections/Media/hooks/inferMediaType.ts](src/collections/Media/hooks/inferMediaType.ts)
**Purpose**: beforeChange field hook with admin override

**Logic**:
```typescript
import type { FieldHook } from 'payload'
import { inferMediaType, validateMimeType } from '@/lib/media/inferMediaType'
import { MediaType } from '@/lib/media/types'

export const inferMediaTypeHook: FieldHook = ({ data, operation, value, req }) => {
  const mimeType = data?.mimeType
  const filename = data?.filename
  const isAdmin = req?.user?.role === 'admin'

  // If admin explicitly set a value, respect it
  if (isAdmin && value && operation === 'update') {
    // Validate that admin's choice matches MIME type
    if (mimeType && !validateMimeType(mimeType, value as MediaType)) {
      req.payload.logger.warn(
        `[Media] Admin override type '${value}' doesn't match MIME '${mimeType}'`
      )
      // Allow admin override anyway (trust admin)
    }
    return value
  }

  // Auto-infer from MIME type
  const inferredType = inferMediaType(mimeType, filename)

  // Log if type is 'other' (unrecognized)
  if (inferredType === MediaType.Other && mimeType) {
    req.payload.logger.warn(
      `[Media] Unrecognized MIME type '${mimeType}' - setting type to 'other'`
    )
  }

  return inferredType
}
```

### 5. [src/collections/Media/hooks/validateMediaUpload.ts](src/collections/Media/hooks/validateMediaUpload.ts)
**Purpose**: beforeValidate collection hook with strict validation

**Validation**:
```typescript
import type { CollectionBeforeValidateHook } from 'payload'
import { inferMediaType, validateMimeType } from '@/lib/media/inferMediaType'
import { MediaType, SIZE_LIMITS } from '@/lib/media/types'

export const validateMediaUploadHook: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create') return data

  const mimeType = data?.mimeType
  const filename = data?.filename
  const filesize = data?.filesize
  const type = data?.type || inferMediaType(mimeType, filename)

  // External type should not have file upload
  if (type === MediaType.External) {
    if (!data?.externalUrl) {
      throw new Error('External media requires an external URL')
    }
    return data
  }

  // Validate MIME type against allowlist
  if (mimeType && type !== MediaType.Other) {
    if (!validateMimeType(mimeType, type)) {
      req.payload.logger.warn(
        `[Media] MIME '${mimeType}' doesn't match type '${type}' - downgrading to 'other'`
      )
      data.type = MediaType.Other
    }
  }

  // Enforce size limits
  if (filesize && type) {
    const maxSize = SIZE_LIMITS[type]
    if (maxSize && filesize > maxSize) {
      throw new Error(
        `File size (${Math.round(filesize / 1024 / 1024)}MB) exceeds maximum for ${type} (${Math.round(maxSize / 1024 / 1024)}MB)`
      )
    }
  }

  return data
}
```

### 6. [src/components/Media/index.tsx](src/components/Media/index.tsx) (MODIFY)
**Purpose**: Frontend dispatcher with legacy fallback

**Logic**:
```typescript
import React, { Fragment } from 'react'
import type { Props } from './types'

import { ImageMedia } from './ImageMedia'
import { VideoMedia } from './VideoMedia'
import { AudioMedia } from './AudioMedia'
import { PDFMedia } from './PDFMedia'
import { SVGMedia } from './SVGMedia'
import { DocumentMedia } from './DocumentMedia'
import { ExternalMedia } from './ExternalMedia'
import { OtherMedia } from './OtherMedia'
import { MediaType } from '@/lib/media/types'
import { inferMediaType } from '@/lib/media/inferMediaType'

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = 'div', resource } = props

  const Tag = htmlElement || Fragment

  // Determine media type
  let mediaType: MediaType = MediaType.Other

  if (typeof resource === 'object' && resource) {
    // Prefer explicit type field
    mediaType = (resource as any).type

    // Fallback to mimeType inference (for legacy data without type field)
    if (!mediaType && resource.mimeType) {
      mediaType = inferMediaType(resource.mimeType, resource.filename)
    }
  }

  return (
    <Tag
      {...(htmlElement !== null
        ? { className }
        : {})}
    >
      {mediaType === MediaType.Video && <VideoMedia {...props} />}
      {mediaType === MediaType.Audio && <AudioMedia {...props} />}
      {mediaType === MediaType.PDF && <PDFMedia {...props} />}
      {mediaType === MediaType.SVG && <SVGMedia {...props} />}
      {mediaType === MediaType.Document && <DocumentMedia {...props} />}
      {mediaType === MediaType.External && <ExternalMedia {...props} />}
      {mediaType === MediaType.Other && <OtherMedia {...props} />}
      {mediaType === MediaType.Image && <ImageMedia {...props} />}
    </Tag>
  )
}
```

### 7. Admin Preview Components ([src/components/admin/MediaPreview/](src/components/admin/MediaPreview/))
**Purpose**: Type-specific previews in admin panel

**New Components**:
- `DocumentPreview.tsx` - Download link with file icon
- `ExternalPreview.tsx` - Shows external URL with link
- `OtherPreview.tsx` - Filename, size, download button

**Example - OtherPreview.tsx**:
```typescript
'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const OtherPreview: React.FC = () => {
  const filenameField = useFormFields(([fields]) => fields.filename)
  const filesizeField = useFormFields(([fields]) => fields.filesize)
  const urlField = useFormFields(([fields]) => fields.url)

  const filename = filenameField?.value as string | undefined
  const filesize = filesizeField?.value as number | undefined
  const url = urlField?.value as string | undefined

  return (
    <div style={{ padding: '1rem' }}>
      <h3>File Preview (Download Only)</h3>
      <p><strong>Filename:</strong> {filename}</p>
      {filesize && (
        <p><strong>Size:</strong> {Math.round(filesize / 1024)} KB</p>
      )}
      {url && (
        <a
          href={url}
          download
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--theme-elevation-300)',
            borderRadius: '4px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Download File
        </a>
      )}
    </div>
  )
}
```

### 8. Frontend Media Components ([src/components/Media/](src/components/Media/))
**Purpose**: Type-specific rendering for frontend

**New Components**:
- `DocumentMedia/index.tsx` - Download link with icon
- `ExternalMedia/index.tsx` - iframe or link (based on URL type)
- `OtherMedia/index.tsx` - Download link with filename and size

**Example - OtherMedia.tsx**:
```typescript
'use client'

import React from 'react'
import type { Props as MediaProps } from '../types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export const OtherMedia: React.FC<MediaProps> = (props) => {
  const { resource } = props

  if (resource && typeof resource === 'object') {
    const { url, filename, filesize } = resource

    return (
      <div className="other-media">
        <a
          href={getMediaUrl(url)}
          download
          className="download-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            textDecoration: 'none',
          }}
        >
          <span>📄</span>
          <span>{filename}</span>
          {filesize && (
            <span style={{ fontSize: '0.875rem', color: '#666' }}>
              ({Math.round(filesize / 1024)} KB)
            </span>
          )}
        </a>
      </div>
    )
  }

  return null
}
```

**Example - ExternalMedia.tsx**:
```typescript
'use client'

import React from 'react'
import type { Props as MediaProps } from '../types'

export const ExternalMedia: React.FC<MediaProps> = (props) => {
  const { resource } = props

  if (resource && typeof resource === 'object') {
    const externalUrl = (resource as any).externalUrl

    if (!externalUrl) {
      return <p>No external URL provided</p>
    }

    // Simple iframe embed (could be enhanced to detect URL type)
    return (
      <div className="external-media">
        <iframe
          src={externalUrl}
          style={{
            width: '100%',
            height: '400px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
          title="External content"
        />
      </div>
    )
  }

  return null
}
```

---

## Implementation Steps

### Phase 1: Type System Foundation
1. Create `src/lib/media/types.ts` - MediaType enum, MIME allowlists, size limits
2. Create `src/lib/media/inferMediaType.ts` - Inference + validation logic

### Phase 2: Collection Schema
1. Create `src/collections/Media/hooks/inferMediaType.ts` - Hook with admin override
2. Create `src/collections/Media/hooks/validateMediaUpload.ts` - Strict validation
3. Update `src/collections/Media.ts` - Add type field, externalUrl, conditional access
4. **Run**: `pnpm generate:types` - Regenerate TypeScript types

### Phase 3: Admin UI Components (MVP - keep simple)
1. Create all 8 admin preview components in `src/components/admin/MediaPreview/`
   - Focus on basic previews, defer rich features
2. **Run**: `pnpm generate:importmap` - Register admin components

### Phase 4: Frontend Components
1. Create 3 new media components (Document, External, Other)
2. Update `src/components/Media/index.tsx` - Add type routing with fallback

### Phase 5: Testing
1. Manual testing: Upload all 8 media types and verify
2. Test admin override: Admin changes type, verify it persists
3. Test unrecognized MIME: Verify it goes to `other`
4. Test MIME mismatch: Verify downgrade to `other`
5. Test legacy media: Verify fallback works

### Phase 6: (Deferred) Enhanced Features
- Zod schemas for runtime validation
- TypeScript type guards
- Rich metadata fields (codec, bitrate, pageCount)
- E2E tests
- Advanced external embed detection

---

## Validation Strategy

### Server-Side Validation (beforeValidate hook)
1. **Type validation**: Check if type matches MIME allowlist → downgrade to `other` if mismatch
2. **Size limits**: Enforce per-type limits → reject if exceeded
3. **External validation**: Require `externalUrl` if type is external
4. **Logging**: Warn on unrecognized MIME types or mismatches

### Admin Override Logic (beforeChange hook)
1. **Non-admin**: Always use auto-inferred type (read-only)
2. **Admin**:
   - If admin sets type manually → use admin value
   - Warn if admin's choice doesn't match MIME type (but allow)
   - Log override for audit trail

### Frontend Fallback
1. **Prefer**: Explicit `type` field
2. **Fallback**: Infer from `mimeType` if `type` is missing (legacy support)
3. **Default**: `other` type if inference fails

---

## MIME Type Allowlists

### Image
- `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- `image/avif`, `image/heic`, `image/heif`, `image/gif`

### Video
- `video/mp4`, `video/webm`, `video/quicktime`
- `video/x-msvideo`, `video/avi`

### Audio
- `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/ogg`
- `audio/m4a`, `audio/x-m4a`, `audio/aac`

### PDF
- `application/pdf`

### SVG
- `image/svg+xml`

### Document
- `application/msword` (DOC)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
- `application/vnd.ms-excel` (XLS)
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)
- `application/vnd.ms-powerpoint` (PPT)
- `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX)
- `text/plain` (TXT)
- `text/csv` (CSV)

### External
- No file upload (URL only)

### Other
- Catch-all for unrecognized types
- Download-only UI

---

## Size Limits

| Type     | Limit  |
|----------|--------|
| Image    | 10 MB  |
| Video    | 100 MB |
| Audio    | 50 MB  |
| PDF      | 20 MB  |
| SVG      | 2 MB   |
| Document | 20 MB  |
| External | 0      |
| Other    | 50 MB  |

---

## Testing Checklist

### Unit Tests (Deferred)
- Test MIME type inference for all types
- Test admin override logic
- Test MIME allowlist validation
- Test size limit enforcement

### Manual Tests (MVP Critical)
- [ ] Upload image (JPG, PNG, WebP, GIF) → verify type=image
- [ ] Upload video (MP4, WebM) → verify type=video
- [ ] Upload audio (MP3, WAV) → verify type=audio
- [ ] Upload PDF → verify type=pdf
- [ ] Upload SVG → verify type=svg
- [ ] Upload document (DOCX, XLSX) → verify type=document
- [ ] Create external media → verify externalUrl field appears
- [ ] Upload unrecognized file (.xyz) → verify type=other
- [ ] Upload file with wrong extension (image.txt with MIME image/png) → verify type=image (trust MIME)
- [ ] Admin override: Change type manually → verify it persists
- [ ] Non-admin: Verify type field is read-only
- [ ] Legacy media: Upload media before this feature → verify fallback inference works
- [ ] Size limit: Upload 200MB video → verify rejection with clear error
- [ ] MIME mismatch: Force wrong type → verify downgrade to other

### Frontend Rendering Tests
- [ ] Verify each type renders correctly in MediaBlock
- [ ] Verify `other` type shows download link
- [ ] Verify `external` type shows iframe/embed
- [ ] Verify legacy media (no type field) renders via fallback

---

## Verification

After implementation, verify:

1. **Type Generation**: `pnpm generate:types` → Media interface includes `type` and `externalUrl`
2. **Import Map**: `pnpm generate:importmap` → Admin components registered
3. **Admin UI**:
   - Upload test files → type auto-populates
   - Admin can override type → persists
   - Non-admin cannot edit type → read-only
4. **Frontend**: All types render correctly
5. **Validation**: Oversized/mismatched uploads handled correctly
6. **Logging**: Check server logs for warnings on unrecognized MIME types

---

## Potential Pitfalls

### 1. Admin Override Logic
**Issue**: Admin override conflicts with hook inference
**Mitigation**: Check operation and user role in hook. Only apply inference if not admin or if admin hasn't set value.

### 2. External Type Without File
**Issue**: External type should not have file upload
**Mitigation**: Conditional validation in beforeValidate hook. Require `externalUrl` for external type.

### 3. MIME Type Variations
**Issue**: Browsers report MIME types differently (e.g., `audio/x-m4a` vs `audio/m4a`)
**Mitigation**: Include variations in allowlists. Normalize in inference function.

### 4. Sharp Processing Non-Images
**Issue**: Sharp tries to process PDFs, videos, documents
**Mitigation**: Monitor logs. If issues, conditionally disable `imageSizes` for non-image types.

### 5. Legacy Media Without Type Field
**Issue**: Existing media breaks if no fallback
**Mitigation**: Robust fallback in Media component: `resource.type || inferMediaType(resource.mimeType)`

### 6. Other Type Flooding
**Issue**: Too many unrecognized files go to `other`
**Mitigation**: Monitor server logs. Expand allowlists as needed. Consider adding new types if patterns emerge.

---

## Success Criteria

- ✅ All 8 media types auto-inferred correctly
- ✅ Admin can override type field
- ✅ Non-admin cannot edit type field (read-only)
- ✅ Unrecognized MIME types forced to `other`
- ✅ MIME mismatch downgrades to `other` (no rejection)
- ✅ Admin panel shows type-specific previews
- ✅ Frontend renders all 8 types correctly
- ✅ `other` type has download-only UI
- ✅ `external` type has embed/link UI
- ✅ Upload validation enforces size limits and allowlists
- ✅ Legacy media without type field renders via fallback
- ✅ No breaking changes to existing Posts/MediaBlock usage

---

## MVP Scope (What to Build Now)

### Include in MVP:
1. ✅ Type field with 8 options
2. ✅ Auto-inference from MIME type
3. ✅ Admin override capability
4. ✅ MIME allowlists and validation
5. ✅ Size limits per type
6. ✅ Basic admin preview components
7. ✅ Basic frontend renderers
8. ✅ `other` and `external` type handling
9. ✅ Legacy media fallback

### Defer Post-MVP:
1. ⏸️ Zod schemas (use Payload validation)
2. ⏸️ TypeScript type guards (use simple checks)
3. ⏸️ Rich metadata (codec, bitrate, pageCount)
4. ⏸️ E2E tests (manual testing for now)
5. ⏸️ Advanced external embed detection (URL parsing)
6. ⏸️ Backfill script for legacy media

---

## Post-Implementation Tasks

1. Monitor server logs for unrecognized MIME types → expand allowlists
2. Gather feedback on admin override UX
3. Add backfill script for legacy media (if needed)
4. Enhance external embed detection (YouTube, Vimeo, etc.)
5. Add rich metadata extraction (use libraries for video/audio duration)
6. Add E2E tests for upload flow
7. Document media type usage patterns
