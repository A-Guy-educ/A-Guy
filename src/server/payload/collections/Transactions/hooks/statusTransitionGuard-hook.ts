/**
 * Status Transition Guard Hook
 *
 * beforeChange hook on Transactions that enforces the status transition table:
 * - pending → completed, failed, refunded (all allowed)
 * - completed → refunded (only this is allowed)
 * - failed → terminal (no transitions allowed)
 * - refunded → terminal (no transitions allowed)
 *
 * Skips validation when req.context.skipTransitionGuard === true (admin bypass).
 * Skips validation on create operations (any starting status is allowed).
 *
 * @fileType hook
 * @domain payments
 * @pattern transaction-log
 */

import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded'

// Define allowed transitions as a map: fromStatus → Set of allowed toStatuses
const ALLOWED_TRANSITIONS: Record<TransactionStatus, readonly TransactionStatus[]> = {
  pending: ['completed', 'failed', 'refunded'],
  completed: ['refunded'],
  failed: [],
  refunded: [],
} as const

export const statusTransitionGuard: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  // Skip validation on create operations — any starting status is allowed
  if (operation === 'create') {
    return data
  }

  // Skip validation when bypass flag is set (admin manual override)
  if (req?.context?.skipTransitionGuard === true) {
    return data
  }

  const newStatus = data.status as TransactionStatus | undefined
  const previousStatus = originalDoc?.status as TransactionStatus | undefined

  // If status is not being changed, allow the update
  if (newStatus === previousStatus || newStatus === undefined) {
    return data
  }

  // Determine the effective previous status for transition checking
  // Use originalDoc.status if available, otherwise fall back to current doc status
  const fromStatus: TransactionStatus = previousStatus || (originalDoc?.status as TransactionStatus)

  // Check if the transition is allowed
  const allowedTargets = ALLOWED_TRANSITIONS[fromStatus]
  if (!allowedTargets || !allowedTargets.includes(newStatus)) {
    throw new APIError(
      `Invalid status transition from ${fromStatus} to ${newStatus}`,
      400,
      undefined,
      true,
    )
  }

  return data
}
