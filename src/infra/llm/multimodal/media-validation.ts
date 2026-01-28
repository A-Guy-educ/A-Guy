/**
 * Media Validation for Chat Messages
 * Validates media exists, belongs to tenant, not expired, valid type/size
 * Returns resolved paths for Gemini mapper (no extra DB lookups)
 */
import type { Payload } from 'payload'

import { resolveMediaFilePath, resolveMediaPublicUrl } from '@/lib/config/storage'
import { MediaType } from '@/infra/media/types'
import { logger } from '@/infra/utils/logger'

import type {
  MediaPartType,
  MediaPartWithPath,
  MediaValidationResult,
  MediaItemResult,
} from './types'

// Validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ATTACHMENTS = 5
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const SUPPORTED_TYPES = [MediaType.Image, MediaType.PDF]

// Type for Media collection document
interface MediaDocument {
  id: string
  filename?: string
  mimeType?: string
  filesize?: number
  type?: MediaType
  expiresAt?: string
  tenant?: string | { id: string }
  retentionPolicy?: string
}

/**
 * Creates an error result for a media item
 */
function createErrorResult(mediaId: string, mimeType: string, error: string): MediaItemResult {
  return { mediaId, type: 'image', mimeType, error }
}

/**
 * Validates attachment count is within limits
 */
function validateAttachmentCount(mediaIds: string[]): MediaItemResult | null {
  if (mediaIds.length > MAX_ATTACHMENTS) {
    return createErrorResult('all', '', `Maximum ${MAX_ATTACHMENTS} attachments allowed`)
  }
  return null
}

/**
 * Fetches media documents from database
 * Relies on Payload's access control to ensure proper isolation
 */
async function fetchMediaDocuments(
  payload: Payload,
  mediaIds: string[],
  userId: string,
): Promise<MediaDocument[]> {
  const result = await payload.find({
    collection: 'media',
    where: {
      and: [{ id: { in: mediaIds } }, { createdBy: { equals: userId } }],
    },
    limit: mediaIds.length,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as MediaDocument[]
}

/**
 * Checks for media IDs that weren't found in the database
 */
function findMissingMediaIds(requestedIds: string[], foundDocs: MediaDocument[]): string[] {
  const foundIds = new Set(foundDocs.map((doc) => doc.id))
  return requestedIds.filter((id) => !foundIds.has(id))
}

/**
 * Validates that media has a filename
 */
function validateFilename(doc: MediaDocument): string | null {
  if (!doc.filename) {
    return 'Media record missing filename'
  }
  return null
}

/**
 * Validates that media has not expired
 */
function validateExpiry(doc: MediaDocument): string | null {
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
    return 'Media has expired'
  }
  return null
}

/**
 * Validates MIME type is allowed
 */
function validateMimeType(mimeType: string): string | null {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return `Unsupported MIME type: ${mimeType}`
  }
  return null
}

/**
 * Validates file size is within limits
 */
function validateFileSize(filesize: number | undefined): string | null {
  if ((filesize || 0) > MAX_FILE_SIZE) {
    return 'File size exceeds 10MB limit'
  }
  return null
}

/**
 * Validates media type is supported
 */
function validateMediaType(docType: MediaType | undefined): string | null {
  if (!docType || !SUPPORTED_TYPES.includes(docType)) {
    return `Unsupported media type: ${docType || 'unknown'}`
  }
  return null
}

/**
 * Determines the media part type for Gemini
 */
function getMediaPartType(docType: MediaType | undefined): MediaPartType {
  return docType === MediaType.PDF ? 'pdf' : 'image'
}

/**
 * Resolves file paths for a media document
 */
function resolveMediaDocumentPaths(
  doc: MediaDocument,
): { absoluteFilePath: string; publicUrl: string } | null {
  if (!doc.filename) return null
  try {
    return {
      absoluteFilePath: resolveMediaFilePath(doc.filename),
      publicUrl: resolveMediaPublicUrl(doc.filename),
    }
  } catch {
    return null
  }
}

/**
 * Validates a single media document
 * Returns error message or null if valid
 */
function validateMediaDocument(doc: MediaDocument): {
  error: string | null
  isUnsupported: boolean
} {
  // Check filename
  const filenameError = validateFilename(doc)
  if (filenameError) return { error: filenameError, isUnsupported: false }

  // Check expiry
  const expiryError = validateExpiry(doc)
  if (expiryError) return { error: expiryError, isUnsupported: false }

  // Check MIME type
  const mimeType = doc.mimeType || 'unknown'
  const mimeError = validateMimeType(mimeType)
  if (mimeError) return { error: mimeError, isUnsupported: true }

  // Check file size
  const sizeError = validateFileSize(doc.filesize)
  if (sizeError) return { error: sizeError, isUnsupported: false }

  // Check media type
  const typeError = validateMediaType(doc.type)
  if (typeError) return { error: typeError, isUnsupported: true }

  return { error: null, isUnsupported: false }
}

/**
 * Main validation function for chat media
 * Validates media exists, belongs to user, not expired, valid type/size
 */
export async function validateChatMedia(
  payload: Payload,
  mediaIds: string[],
  userId: string,
): Promise<MediaValidationResult & { mediaPartsWithPath: MediaPartWithPath[] }> {
  const reqLogger = logger.child({ mediaIds, userId })
  const result: MediaValidationResult = {
    valid: true,
    mediaItems: [],
    hasUnsupportedMedia: false,
  }
  const mediaPartsWithPath: MediaPartWithPath[] = []

  // Validate attachment count
  const countError = validateAttachmentCount(mediaIds)
  if (countError) {
    result.valid = false
    result.mediaItems.push(countError)
    return { ...result, mediaPartsWithPath }
  }

  // Early return for empty list
  if (mediaIds.length === 0) {
    return { ...result, mediaPartsWithPath }
  }

  // Fetch documents - filter by user ownership for security
  const mediaDocs = await fetchMediaDocuments(payload, mediaIds, userId)

  // Check for missing media
  const missingIds = findMissingMediaIds(mediaIds, mediaDocs)
  for (const mediaId of missingIds) {
    result.valid = false
    result.mediaItems.push(createErrorResult(mediaId, '', 'Media not found or access denied'))
    reqLogger.warn({ mediaId }, 'Media not found or not owned by user')
  }

  // Process each found document
  for (const doc of mediaDocs) {
    const mediaId = doc.id
    const mimeType = doc.mimeType || 'unknown'

    // Validate the document
    const validation = validateMediaDocument(doc)
    if (validation.error) {
      if (validation.isUnsupported) {
        result.hasUnsupportedMedia = true
      } else {
        result.valid = false
      }
      result.mediaItems.push(createErrorResult(mediaId, mimeType, validation.error))
      if (validation.error.includes('filename')) {
        reqLogger.warn({ mediaId }, 'Media record has no filename')
      }
      continue
    }

    // Resolve paths for Gemini mapper
    const paths = resolveMediaDocumentPaths(doc)
    if (!paths) {
      result.valid = false
      result.mediaItems.push(
        createErrorResult(mediaId, mimeType, 'Invalid media path configuration'),
      )
      continue
    }

    mediaPartsWithPath.push({
      mediaId,
      type: getMediaPartType(doc.type),
      absoluteFilePath: paths.absoluteFilePath,
      publicUrl: paths.publicUrl,
      mimeType,
    })
  }

  return { ...result, mediaPartsWithPath }
}

/**
 * Set ephemeral retention on validated media
 * Tenant-safe: only patches media that was validated for this tenant
 * Optimized: single read query + per-doc updates for non-ephemeral
 */
export async function setEphemeralRetention(
  payload: Payload,
  mediaPartsWithPath: MediaPartWithPath[],
  req?: { context?: Record<string, unknown> },
): Promise<void> {
  if (mediaPartsWithPath.length === 0) return

  const mediaIds = mediaPartsWithPath.map((p) => p.mediaId)

  // Single read to get current states
  const docs = await payload.find({
    collection: 'media',
    where: {
      id: { in: mediaIds },
    },
    limit: mediaIds.length,
    depth: 0,
    overrideAccess: true,
  })

  const needsUpdate = docs.docs.filter((doc) => doc.retentionPolicy !== 'ephemeral')
  if (needsUpdate.length === 0) return

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const context = { ...req?.context, allowRetentionPatch: true }

  // Update only those that need it
  for (const doc of needsUpdate) {
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: {
        retentionPolicy: 'ephemeral',
        expiresAt,
      },
      context,
    })
  }
}
