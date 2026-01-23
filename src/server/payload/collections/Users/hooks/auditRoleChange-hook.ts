import type { CollectionAfterChangeHook } from 'payload'
import { logger } from '@/infra/utils/logger'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'

/**
 * HOOK: Payload CMS lifecycle hook that runs automatically after a user record changes
 *
 * Naming clarification:
 * - HOOK: Payload CMS lifecycle function (beforeChange, afterChange, etc.) - runs automatically
 * - ACTION: Server action called by client (e.g., signup_createUser-action.ts) - explicitly invoked
 * - HANDLER: Error/event handler function (e.g., signup_handlers.ts) - called by actions/hooks
 *
 * This is a HOOK because it runs automatically via Payload's lifecycle system.
 * It logs role changes for audit trail (security/compliance).
 */
export const auditRoleChange: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  previousDoc,
}) => {
  // Only audit on update operations
  if (operation !== 'update') return doc

  // Check if role changed
  const oldRole = previousDoc?.role
  const newRole = doc.role

  if (oldRole !== newRole) {
    const requestId = crypto.randomUUID()
    const changedBy = isUsersCollectionUser(req.user) ? req.user.id : 'system'
    const changedByEmail = isUsersCollectionUser(req.user) ? req.user.email : 'system'

    logger.info(
      {
        requestId,
        action: 'user_role_change',
        userId: doc.id,
        userEmail: doc.email,
        oldRole,
        newRole,
        changedBy,
        changedByEmail,
        timestamp: new Date().toISOString(),
      },
      `User role changed: ${doc.email} from ${oldRole} to ${newRole} by ${changedByEmail}`,
    )
  }

  return doc
}
