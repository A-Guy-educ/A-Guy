import type { Access } from 'payload'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

/**
 * Access control for EnrollmentProgress collection.
 * Admins can access all records.
 * Users can only access progress records for their own enrollments (via user field).
 */
export const enrollmentProgressAccess: Access = ({ req: { user } }) => {
  if (!isUsersCollectionUser(user)) return false

  // Admins can access all records
  if (user.role === AccountRole.Admin) return true

  // Users can only access their own progress records (via user field set from enrollment)
  return {
    user: { equals: user.id },
  }
}
