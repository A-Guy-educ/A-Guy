import type { User } from '@/payload-types'
import type { AccessArgs } from 'payload'

import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'

type AdminOrContentEditorAccess = (args: AccessArgs<User>) => boolean

/**
 * Access control that allows users with role='admin' OR role='advanced-content-editor'
 */
export const adminOrContentEditor: AdminOrContentEditorAccess = ({ req: { user } }) => {
  if (!isUsersCollectionUser(user)) {
    return false
  }

  return user.role === AccountRole.Admin || user.role === AccountRole.AdvancedContentEditor
}
