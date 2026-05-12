/**
 * Payment Dashboard Metrics API
 *
 * @fileType api-route
 * @domain payments
 * @ai-summary Admin API for payment dashboard widgets
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export type PaymentPeriod = 'week' | 'month' | 'year'

interface PaymentMetrics {
  transactions: {
    completed: number
    failed: number
    refunded: number
  }
  revenue: {
    total: number
    currency: string
  }
  subscriptions: {
    active: number
    expiredThisPeriod: number
  }
}

export interface PaymentDashboardResponse {
  period: PaymentPeriod
  metrics: PaymentMetrics
}

function getPeriodStart(now: Date, period: PaymentPeriod): Date {
  switch (period) {
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
}

export async function GET(req: Request): Promise<Response> {
  const payload = await getPayload({ config })

  // Auth check
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (
    !('collection' in authResult.user) ||
    authResult.user.collection !== 'users' ||
    authResult.user.role !== 'admin'
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const period = (url.searchParams.get('period') || 'month') as PaymentPeriod
  if (!['week', 'month', 'year'].includes(period)) {
    return Response.json({ error: 'Invalid period' }, { status: 400 })
  }

  const now = new Date()
  const periodStart = getPeriodStart(now, period)

  // Fetch all metrics in parallel
  const [
    completedTransactions,
    failedTransactions,
    refundedTransactions,
    activeSubscriptions,
    allTransactions,
  ] = await Promise.all([
    // Completed transactions in period
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { status: { equals: 'completed' } },
          { createdAt: { greater_than_equal: periodStart.toISOString() } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    }),
    // Failed transactions in period
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { status: { equals: 'failed' } },
          { createdAt: { greater_than_equal: periodStart.toISOString() } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    }),
    // Refunded transactions in period
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { status: { equals: 'refunded' } },
          { createdAt: { greater_than_equal: periodStart.toISOString() } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    }),
    // Active subscriptions
    payload.find({
      collection: 'subscriptions',
      where: { status: { equals: 'active' } },
      limit: 0,
      overrideAccess: true,
    }),
    // All completed transactions in period for revenue calculation
    payload.find({
      collection: 'transactions',
      where: {
        and: [
          { status: { equals: 'completed' } },
          { createdAt: { greater_than_equal: periodStart.toISOString() } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  // Calculate total revenue
  let totalRevenue = 0
  const revenueCurrency = 'ILS' // Default currency

  for (const tx of allTransactions.docs) {
    if (tx && typeof tx === 'object' && 'amount' in tx && typeof tx.amount === 'number') {
      totalRevenue += tx.amount
    }
  }

  const response: PaymentDashboardResponse = {
    period,
    metrics: {
      transactions: {
        completed: completedTransactions.totalDocs,
        failed: failedTransactions.totalDocs,
        refunded: refundedTransactions.totalDocs,
      },
      revenue: {
        total: totalRevenue,
        currency: revenueCurrency,
      },
      subscriptions: {
        active: activeSubscriptions.totalDocs,
        expiredThisPeriod: 0, // Would need separate query
      },
    },
  }

  return Response.json(response)
}
