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
        `[Media] MIME '${mimeType}' doesn't match type '${type}' - downgrading to 'other'`,
      )
      data.type = MediaType.Other
    }
  }

  // Enforce size limits
  if (filesize && type && type in SIZE_LIMITS) {
    const maxSize = SIZE_LIMITS[type as MediaType]
    if (maxSize && filesize > maxSize) {
      throw new Error(
        `File size (${Math.round(filesize / 1024 / 1024)}MB) exceeds maximum for ${type} (${Math.round(maxSize / 1024 / 1024)}MB)`,
      )
    }
  }

  return data
}
