import type { FieldHook } from 'payload'

import { inferMediaType, validateMimeType } from '@/server/media/inferMediaType'
import { MediaType } from '@/server/media/types'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

export const inferMediaTypeHook: FieldHook = ({ data, operation, value, req }) => {
  const mimeType = data?.mimeType
  const filename = data?.filename
  const isAdmin = isUsersCollectionUser(req.user) && req.user.role === AccountRole.Admin

  // If admin explicitly set a value, respect it
  if (isAdmin && value && operation === 'update') {
    // Validate that admin's choice matches MIME type
    if (mimeType && !validateMimeType(mimeType, value as MediaType)) {
      req.payload.logger.warn(
        `[Media] Admin override type '${value}' doesn't match MIME '${mimeType}'`,
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
      `[Media] Unrecognized MIME type '${mimeType}' - setting type to 'other'`,
    )
  }

  return inferredType
}
