import type { Access } from 'payload'

/**
 * Access control for collections with custom status field
 *
 * @description
 * - Authenticated users see all content (draft, published, archived)
 * - Anonymous users only see published content
 *
 * This differs from `authenticatedOrPublished` which uses `_status`
 * (Payload's built-in draft system). This function uses the custom
 * `status` field instead.
 */
export const publishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return {
    status: {
      equals: 'published',
    },
  }
}
