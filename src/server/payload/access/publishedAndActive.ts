import type { Access } from 'payload'

/**
 * Access control helper for collections with custom `status` field.
 *
 * - If req.user is present (authenticated), allows full read access.
 * - If req.user is absent (anonymous), restricts to:
 *   - status = 'published'
 *   - isActive = true
 *
 * IMPORTANT: This helper uses the custom `status` field (not Payload's `_status`).
 * Use this for courses, chapters, lessons collections that have custom status.
 */
export const publishedAndActive: Access = ({ req: { user } }) => {
  // Authenticated users can read everything
  if (user) {
    return true
  }

  // Anonymous users can only read published+active documents
  return {
    status: { equals: 'published' },
    isActive: { equals: true },
  }
}
