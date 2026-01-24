/**
 * Access Control for Config Collections
 *
 * @fileType access-control
 * @domain config
 * @pattern admin-only
 * @ai-summary Access control that restricts config operations to admins only
 */

import type { User } from '@/payload-types'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import type { AccessArgs } from 'payload'

type ConfigAccess = (args: AccessArgs<User>) => boolean

/**
 * Access control that only allows users with role='admin'
 */
export const configAdminOnly: ConfigAccess = ({ req: { user } }) => {
  if (!isUsersCollectionUser(user)) {
    return false
  }

  return user.role === AccountRole.Admin
}
