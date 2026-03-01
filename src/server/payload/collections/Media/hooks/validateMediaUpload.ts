import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

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

  // Guard: if req.file exists but data lacks metadata, log warning and skip validation
  // This handles edge case where generateFileData processed the file but race condition left data incomplete
  if (req.file && (!mimeType || !filename)) {
    req.payload.logger.warn(
      '[Media] File present on request but metadata not in data — skipping validation (client upload edge case)',
    )
    return data
  }

  // External type should not have file upload
  if (type === MediaType.External) {
    if (!data?.externalUrl) {
      req.payload.logger.warn('[Media] External media requires an external URL')
      throw new APIError('External media requires an external URL', 400)
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

  // Non-external types require a file (safety net since filesRequiredOnCreate is false)
  if (!mimeType && !filename) {
    req.payload.logger.warn('[Media] Upload attempted without file or metadata')
    throw new APIError(
      'A file is required for non-external media types. Please select a file to upload.',
      400,
    )
  }

  // Validate MIME type against allowlist
  if (mimeType && type !== MediaType.Other) {
    if (!validateMimeType(mimeType, type)) {
      req.payload.logger.warn(
        `[Media] MIME '${mimeType}' doesn't match type '${type}' - downgrading to 'other'`,
      )
      data.type = MediaType.Other
    }
  }

  // Enforce size limits
  if (filesize && type && type in SIZE_LIMITS) {
    const maxSize = SIZE_LIMITS[type as MediaType]
    if (maxSize && filesize > maxSize) {
      const sizeMB = Math.round(filesize / 1024 / 1024)
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      req.payload.logger.warn(
        `[Media] File size (${sizeMB}MB) exceeds maximum for ${type} (${maxSizeMB}MB)`,
      )
      throw new APIError(
        `File size (${sizeMB}MB) exceeds maximum for ${type} (${maxSizeMB}MB)`,
        400,
      )
    }
  }

  return data
}
