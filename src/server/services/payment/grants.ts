/**
 * Payment Grants Service
 *
 * @fileType service
 * @domain payments
 * @ai-summary Handles entitlement granting/revocation after payment
 */

import type { Payload } from 'payload'

import { getDefaultTenantId } from '@/server/services/tenant/get-default-tenant'
import type { User } from '@/payload-types'

// Interface for course entitlement item with expiresAt
interface CourseEntitlementItem {
  course: string | { id: string }
  grantMethod: 'admin' | 'payment' | 'code'
  grantedAt: string
  expiresAt?: string | null
}

export interface GrantEntitlementParams {
  payload: Payload
  userId: string
  pricingPlanId: string
  transactionId: string
}

export interface GrantEntitlementResult {
  success: boolean
  expiresAt?: string
}

// Extended pricing plan type with lesson populated (when fetched with depth)
interface PricingPlanWithLesson {
  id: string
  lesson?: {
    id: string
    course?: {
      id: string
    }
  }
  billingType?: 'one_time' | 'subscription'
  interval?: 'month' | 'year'
  entitlementDurationDays?: number | null
}

/**
 * Grant entitlement after successful payment
 */
export async function grantEntitlementAfterPurchase({
  payload,
  userId,
  pricingPlanId,
  transactionId: _transactionId,
}: GrantEntitlementParams): Promise<GrantEntitlementResult> {
  // Fetch pricing plan with lesson info
  const plan = (await payload.findByID({
    collection: 'pricing-plans',
    id: pricingPlanId,
    depth: 2,
    overrideAccess: true,
  })) as PricingPlanWithLesson | null

  if (!plan) {
    throw new Error(`Pricing plan ${pricingPlanId} not found`)
  }

  // Get course ID from lesson
  const courseId = plan.lesson?.course?.id
  if (!courseId) {
    throw new Error(`No course found for pricing plan ${pricingPlanId}`)
  }

  const now = new Date()
  let expiresAt: string | null = null

  if (plan.billingType === 'subscription') {
    // Subscription: set expiresAt to end of current period
    const interval = plan.interval || 'month'
    const periodEnd = new Date(now)

    if (interval === 'month') {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    } else if (interval === 'year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    }

    expiresAt = periodEnd.toISOString()

    // Get default tenant ID
    const tenantId = await getDefaultTenantId(payload)

    // Create subscription record
    await payload.create({
      collection: 'subscriptions',
      data: {
        tenant: tenantId,
        user: userId,
        pricingPlan: pricingPlanId,
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: expiresAt,
        cancelAtPeriodEnd: false,
      },
      draft: false,
      overrideAccess: true,
    })

    // Update user subscription fields
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        subscriptionStatus: 'active',
        currentPeriodEnd: expiresAt,
        cancelAtPeriodEnd: false,
      },
      overrideAccess: true,
    })
  } else {
    // One-time purchase: set expiration based on entitlementDurationDays
    const durationDays = plan.entitlementDurationDays
    if (durationDays && durationDays > 0) {
      const periodEnd = new Date(now)
      periodEnd.setDate(periodEnd.getDate() + durationDays)
      expiresAt = periodEnd.toISOString()
    }
  }

  // Upsert course entitlement on user
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    select: { courseEntitlements: true },
  })) as (User & { courseEntitlements?: CourseEntitlementItem[] }) | null

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  const existingEntitlements: CourseEntitlementItem[] =
    (user.courseEntitlements as CourseEntitlementItem[]) || []

  // Find existing entitlement for this course
  const existingIndex = existingEntitlements.findIndex((e) => {
    const entCourseId = typeof e.course === 'string' ? e.course : e.course?.id
    return entCourseId === courseId && e.grantMethod === 'payment'
  })

  let updatedEntitlements = [...existingEntitlements]

  const newEntitlement = {
    course: courseId,
    grantMethod: 'payment' as const,
    grantedAt: now.toISOString(),
    expiresAt: expiresAt || null,
  }

  if (existingIndex >= 0) {
    // Replace existing payment entitlement
    updatedEntitlements[existingIndex] = newEntitlement
  } else {
    // Add new entitlement
    updatedEntitlements.push(newEntitlement)
  }

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      courseEntitlements: updatedEntitlements,
    },
    overrideAccess: true,
  })

  return { success: true, expiresAt: expiresAt || undefined }
}

/**
 * Revoke entitlements when subscription is cancelled
 */
export async function revokeEntitlementsOnCancellation({
  payload,
  userId,
}: {
  payload: Payload
  userId: string
}): Promise<void> {
  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      subscriptionStatus: 'cancelled',
      cancelAtPeriodEnd: true,
    },
    overrideAccess: true,
  })
}

/**
 * Process expired entitlements - remove expired payment entitlements
 */
export async function processExpiredEntitlements({
  payload,
  userId,
}: {
  payload: Payload
  userId: string
}): Promise<{ revoked: number }> {
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    select: { courseEntitlements: true, subscriptionStatus: true },
  })) as User | null

  if (!user) {
    return { revoked: 0 }
  }

  const now = new Date()
  const entitlements = user.courseEntitlements || []
  const initialCount = entitlements.length

  // Filter out expired payment entitlements
  const validEntitlements = entitlements.filter((e) => {
    if (e.grantMethod !== 'payment') return true
    if (!e.expiresAt) return true
    return new Date(e.expiresAt) > now
  })

  const revoked = initialCount - validEntitlements.length

  if (revoked > 0) {
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        courseEntitlements: validEntitlements,
        // If no more active entitlements and subscription was active, mark as expired
        ...(user.subscriptionStatus === 'active' && revoked > 0
          ? { subscriptionStatus: 'expired' }
          : {}),
      },
      overrideAccess: true,
    })
  }

  return { revoked }
}
