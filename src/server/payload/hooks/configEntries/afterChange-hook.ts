/**
 * ConfigEntries After Change Hook
 *
 * @fileType hook
 * @domain config
 * @pattern audit-log
 * @ai-summary Creates audit log entries after config mutations
 *
 * Security (CRITICAL):
 * - Always pass req to nested operations for transaction safety
 * - Never log secret values in plaintext
 * - Use context to prevent infinite hook loops
 * - Use overrideAccess to bypass collection create restriction
 */

import type { CollectionAfterChangeHook } from 'payload'

type ConfigAuditAction = 'created' | 'updated' | 'enabled' | 'disabled'

export const afterChangeAuditLog: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
  previousDoc,
}) => {
  // Skip if we triggered this ourselves (prevent infinite loop)
  if (req.context._skipAuditLog) {
    return doc
  }

  const { payload } = req

  // Get the action from beforeChange hook (stored in context)
  const action: ConfigAuditAction =
    (req.context.configAction as ConfigAuditAction) ||
    (operation === 'create' ? 'created' : 'updated')

  // Ensure we have a user for the actor field
  const actorId =
    req.user && typeof req.user === 'object' && 'id' in req.user
      ? (req.user as { id: string }).id
      : ''

  // =========================================================================
  // Create Audit Log Entry (CRITICAL: pass req for transaction safety)
  // Use overrideAccess: true to bypass collection's create: () => false
  // =========================================================================
  await payload.create({
    collection: 'config_audit_logs',
    draft: false,
    data: {
      key: doc.key,
      kind: doc.kind,
      action: action,
      actor: actorId,
      // No reason field in this implementation (can be added later)
    },
    req, // CRITICAL: Pass req for transaction safety
    overrideAccess: true, // Bypass create restriction - hooks can create
    context: {
      _skipAuditLog: true, // Prevent audit hook from triggering itself
    },
  })

  return doc
}
