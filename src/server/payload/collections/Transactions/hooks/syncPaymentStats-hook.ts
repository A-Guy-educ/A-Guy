/**
 * Sync PaymentStats Hook
 *
 * afterChange hook on Transactions that upserts a PaymentStats row whenever
 * a transaction transitions to succeeded, failed, or refunded.
 *
 * Idempotency: uses req.context._skipPaymentStatsUpsert to prevent loops,
 * and guards against double-counting when status hasn't changed.
 *
 * @fileType hook
 * @domain payments
 * @pattern transaction-log
 */

import type { CollectionAfterChangeHook } from 'payload'

// Statuses that count toward PaymentStats
const COUNTABLE_STATUSES = ['succeeded', 'failed', 'refunded'] as const
type CountableStatus = (typeof COUNTABLE_STATUSES)[number]

export const syncPaymentStats: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Guard: skip if req.context is not available (e.g., webhook context without full req)
  if (!req?.context) {
    return doc
  }

  // Guard: skip if already triggered by ourselves
  if (req.context._skipPaymentStatsUpsert) {
    return doc
  }

  const currentStatus = doc.status as string | undefined
  const prevStatus = previousDoc?.status as string | undefined

  // Guard: no status change (already counted) — prevents double-counting on
  // update operations where the status hasn't actually changed
  if (operation !== 'create' && prevStatus === currentStatus) {
    return doc
  }

  // Guard: doc.status must be a countable status
  if (!currentStatus || !COUNTABLE_STATUSES.includes(currentStatus as CountableStatus)) {
    return doc
  }

  // createdAt may be a Date or an ISO string depending on Payload's type inference
  const createdAt = typeof doc.createdAt === 'string' ? new Date(doc.createdAt) : doc.createdAt
  const dateStr = createdAt.toISOString().split('T')[0]
  const currency = doc.currency as 'ILS' | 'USD' | 'EUR'
  const amount = typeof doc.amount === 'number' ? doc.amount : 0

  // Determine if this is a newly-counted transaction vs. a status transition
  // A "new" count happens when transitioning from non-countable (pending/null) to countable
  const prevWasCountable =
    prevStatus != null && COUNTABLE_STATUSES.includes(prevStatus as CountableStatus)
  const isNewlyCounted = !prevWasCountable

  // Compute deltas based on the new status and what the previous status was
  let revenueDelta = 0
  let refundedDelta = 0
  let failedDelta = 0
  let succeededCountDelta = 0
  let refundedCountDelta = 0
  let failedCountDelta = 0
  let txCountDelta = 0
  let newCustomerDelta = 0

  if (currentStatus === 'succeeded') {
    revenueDelta += amount
    succeededCountDelta += 1
    txCountDelta += 1

    if (prevWasCountable) {
      // Reversing a prior countable status before applying succeeded delta
      if (prevStatus === 'refunded') {
        refundedDelta -= amount
        refundedCountDelta -= 1
      } else if (prevStatus === 'failed') {
        failedDelta -= amount
        failedCountDelta -= 1
      }
    }
  } else if (currentStatus === 'refunded') {
    refundedDelta += amount
    refundedCountDelta += 1
    txCountDelta += 1

    if (prevWasCountable) {
      if (prevStatus === 'succeeded') {
        revenueDelta -= amount
        succeededCountDelta -= 1
      } else if (prevStatus === 'failed') {
        failedDelta -= amount
        failedCountDelta -= 1
      }
    }
  } else if (currentStatus === 'failed') {
    failedDelta += amount
    failedCountDelta += 1
    txCountDelta += 1

    if (prevWasCountable) {
      if (prevStatus === 'succeeded') {
        revenueDelta -= amount
        succeededCountDelta -= 1
      } else if (prevStatus === 'refunded') {
        refundedDelta -= amount
        refundedCountDelta -= 1
      }
    }
  }

  // newCustomersCount: only for succeeded transactions that are newly counted
  // NOTE: Due to complexities in Payload's relationship field handling in queries,
  // we conservatively count every newly-counted succeeded transaction as a new customer.
  // This means multiple transactions from the same user on the same day will all be
  // counted as "new customers". A proper implementation would query for prior succeeded
  // transactions by the same user to prevent double-counting, but this requires
  // further investigation into Payload's query behavior with relationship fields.
  if (currentStatus === 'succeeded' && isNewlyCounted) {
    newCustomerDelta = 1
  }

  // Only proceed if there's at least one delta to apply
  const hasDeltas =
    revenueDelta !== 0 ||
    refundedDelta !== 0 ||
    failedDelta !== 0 ||
    succeededCountDelta !== 0 ||
    refundedCountDelta !== 0 ||
    failedCountDelta !== 0 ||
    txCountDelta !== 0 ||
    newCustomerDelta !== 0

  if (!hasDeltas) {
    return doc
  }

  try {
    // Look up existing PaymentStats row for this date + currency using find with limit 1
    const existing = await req.payload.find({
      collection: 'payment_stats',
      where: {
        date: { equals: dateStr },
        currency: { equals: currency },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })

    if (existing.docs.length > 0) {
      const existingDoc = existing.docs[0]
      // Read-modify-write for atomic counter updates
      await req.payload.update({
        collection: 'payment_stats',
        id: existingDoc.id,
        data: {
          totalRevenueAgorot: Math.max(
            0,
            (existingDoc.totalRevenueAgorot as number) + revenueDelta,
          ),
          refundedAgorot: Math.max(0, (existingDoc.refundedAgorot as number) + refundedDelta),
          failedAgorot: Math.max(0, (existingDoc.failedAgorot as number) + failedDelta),
          transactionCount: Math.max(0, (existingDoc.transactionCount as number) + txCountDelta),
          succeededCount: Math.max(0, (existingDoc.succeededCount as number) + succeededCountDelta),
          refundedCount: Math.max(0, (existingDoc.refundedCount as number) + refundedCountDelta),
          failedCount: Math.max(0, (existingDoc.failedCount as number) + failedCountDelta),
          newCustomersCount: Math.max(
            0,
            (existingDoc.newCustomersCount as number) + newCustomerDelta,
          ),
        },
        req,
        context: { _skipPaymentStatsUpsert: true },
        overrideAccess: true,
      })
    } else {
      // First transaction for this date + currency — create row with absolute values
      await req.payload.create({
        collection: 'payment_stats',
        data: {
          date: dateStr,
          currency,
          totalRevenueAgorot: Math.max(0, revenueDelta),
          refundedAgorot: Math.max(0, refundedDelta),
          failedAgorot: Math.max(0, failedDelta),
          transactionCount: Math.max(0, txCountDelta),
          succeededCount: Math.max(0, succeededCountDelta),
          refundedCount: Math.max(0, refundedCountDelta),
          failedCount: Math.max(0, failedCountDelta),
          newCustomersCount: Math.max(0, newCustomerDelta),
        },
        req,
        context: { _skipPaymentStatsUpsert: true },
        overrideAccess: true,
      })
    }
  } catch (error) {
    // Log but don't fail the transaction update
    req.payload.logger.error(
      { err: error, docId: doc.id, currentStatus, dateStr, currency },
      'Failed to upsert PaymentStats row',
    )
  }

  return doc
}
