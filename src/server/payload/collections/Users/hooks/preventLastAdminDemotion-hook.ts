import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

import { AccountRole } from '../roles'

/**
 * beforeChange hook that prevents demoting the last admin to student
 * This ensures there's always at least one admin in the system
 */
export const preventLastAdminDemotion: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  // Only check on update operations where role is being changed to student
  if (operation !== 'update') return data
  if (data.role !== AccountRole.Student) return data
  if (originalDoc?.role !== AccountRole.Admin) return data

  // This admin is being demoted - check if they're the last one
  const { totalDocs: adminCount } = await req.payload.count({
    collection: 'users',
    where: {
      role: { equals: AccountRole.Admin },
    },
    overrideAccess: true,
    req,
  })

  if (adminCount <= 1) {
    throw new ValidationError({
      errors: [
        {
          message: 'Cannot demote the last admin. There must be at least one admin in the system.',
          path: 'role',
        },
      ],
    })
  }

  return data
}
