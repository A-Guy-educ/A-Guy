/**
 * Access Control for ChatAssets Collection
 */

import type { Access } from 'payload'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

export const chatAssetsReadAccess: Access = ({ req: { user } }) => {
  if (!isUsersCollectionUser(user)) return false

  // Admins can access all records
  if (user.role === AccountRole.Admin) return true

  // Users can only access their own records
  return {
    createdBy: { equals: user.id },
  }
}
