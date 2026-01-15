import type { Access } from 'payload'

import { AccountRole } from '@/collections/Users/roles'

/**
 * Access control that allows admins to access all records,
 * or authenticated users to access their own records (query constraint)
 */
export const authenticatedOrOwner: Access = ({ req: { user } }) => {
  if (!user) return false

  // Admins can access all records
  if (user.role === AccountRole.Admin) return true

  // Users can only access their own records
  return {
    user: { equals: user.id },
  }
}
