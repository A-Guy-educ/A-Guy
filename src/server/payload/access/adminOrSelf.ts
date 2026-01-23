import type { Access } from 'payload'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

/**
 * Access control that allows admins to access all records,
 * or users to access their own record (query constraint)
 */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!isUsersCollectionUser(user)) return false

  // Admins can access all records
  if (user.role === AccountRole.Admin) return true

  // Users can only access their own record
  return {
    id: { equals: user.id },
  }
}
