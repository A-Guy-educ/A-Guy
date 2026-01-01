import type { AccessArgs } from 'payload'
import type { User } from '@/payload-types'

import { Role } from '@/collections/Users/roles'

type AdminOnlyAccess = (args: AccessArgs<User>) => boolean

/**
 * Access control that only allows users with role='admin'
 */
export const adminOnly: AdminOnlyAccess = ({ req: { user } }) => {
  return user?.role === Role.Admin
}
