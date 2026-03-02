import type { CollectionBeforeValidateHook } from 'payload'

import { inferMediaType, validateMimeType } from '@/infra/media/inferMediaType'
import { MediaType, SIZE_LIMITS } from '@/infra/media/types'

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

  // Guard: skip validation if file exists but data lacks metadata (client upload edge case)
  if (req.file && (!mimeType || !filename)) {
    return data
  }

  // External type should not have file upload
  if (type === MediaType.External) {
    if (!data?.externalUrl) {
      throw new Error('External media requires an external URL')
    }
    // Set filename from URL hostname if not provided
    if (!data.filename) {
      try {
        data.filename = new URL(data.externalUrl).hostname
      } catch {
        data.filename = 'External'
      }
    }
    return data
  }

  // Non-external types require a file
  if (!mimeType && !filename) {
    throw new Error(
      'A file is required for non-external media types. Please select a file to upload.',
    )
  }

  // Validate MIME type against allowlist
  if (mimeType && type !== MediaType.Other) {
    if (!validateMimeType(mimeType, type)) {
      data.type = MediaType.Other
    }
  }

  // Enforce size limits
  if (filesize && type && type in SIZE_LIMITS) {
    const maxSize = SIZE_LIMITS[type as MediaType]
    if (maxSize && filesize > maxSize) {
      const sizeMB = Math.round(filesize / 1024 / 1024)
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      throw new Error(`File size (${sizeMB}MB) exceeds maximum for ${type} (${maxSizeMB}MB)`)
    }
  }

  return data
}
