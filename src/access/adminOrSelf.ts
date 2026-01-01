import type { Access } from 'payload'

import { Role } from '@/collections/Users/roles'

/**
 * Access control that allows admins to access all records,
 * or users to access their own record (query constraint)
 */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false

  // Admins can access all records
  if (user.role === Role.Admin) return true

  // Users can only access their own record
  return {
    id: { equals: user.id },
  }
}
