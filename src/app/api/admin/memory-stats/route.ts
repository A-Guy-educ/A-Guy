/**
 * Admin Memory Stats API
 *
 * GET /api/admin/memory-stats
 * Returns aggregate statistics about memory items (total count, per-user breakdown,
 * type distribution, average importance, creation date distribution).
 * Admin-only — returns 403 for non-admin users.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

export type MemoryStatsResponse = {
  totalCount: number
  byUser: Array<{ userId: string; count: number }>
  byType: Record<string, number>
  averageImportance: number
  byDate: {
    daily: Array<{ date: string; count: number }>
    weekly: Array<{ weekStart: string; count: number }>
    monthly: Array<{ month: string; count: number }>
  }
}

/**
 * Fetch every matching doc via pagination — used for queries that need to
 * process all results in-process (e.g. for aggregation). Returns a flat array
 * of docs across all pages.
 */
async function findAll<T>(
  fetchPage: (page: number) => Promise<{ docs: T[]; hasNextPage: boolean; totalPages: number }>,
): Promise<T[]> {
  const results: T[] = []
  let page = 1
  // Cap at 20 pages (e.g. 20 * 500 = 10,000 docs) as a safety net against runaway loops.
  const maxPages = 20
  while (page <= maxPages) {
    const res = await fetchPage(page)
    results.push(...res.docs)
    if (!res.hasNextPage) break
    page++
  }
  return results
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

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

  // Only count active memory items (not deprecated)
  const [totalResult, allItems] = await Promise.all([
    payload.find({
      collection: 'memory_items',
      where: { status: { equals: 'active' } },
      limit: 0,
      overrideAccess: true,
    }),
    findAll<{ userId: string; type: string; importance: number; createdAt: string }>(
      (page) =>
        payload.find({
          collection: 'memory_items',
          where: { status: { equals: 'active' } },
          limit: 500,
          page,
          overrideAccess: true,
          select: { userId: true, type: true, importance: true, createdAt: true },
        }) as Promise<{
          docs: { userId: string; type: string; importance: number; createdAt: string }[]
          hasNextPage: boolean
          totalPages: number
        }>,
    ),
  ])

  // Aggregate: by user
  const byUserMap = new Map<string, number>()
  for (const item of allItems) {
    byUserMap.set(item.userId, (byUserMap.get(item.userId) ?? 0) + 1)
  }
  const byUser = Array.from(byUserMap.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)

  // Aggregate: by type
  const byTypeMap = new Map<string, number>()
  for (const item of allItems) {
    byTypeMap.set(item.type, (byTypeMap.get(item.type) ?? 0) + 1)
  }
  const byType = Object.fromEntries(byTypeMap)

  // Aggregate: average importance
  const totalImportance = allItems.reduce((sum, item) => sum + item.importance, 0)
  const averageImportance = allItems.length > 0 ? totalImportance / allItems.length : 0

  // Aggregate: by date (daily, weekly, monthly)
  const dailyMap = new Map<string, number>()
  const weeklyMap = new Map<string, number>()
  const monthlyMap = new Map<string, number>()

  for (const item of allItems) {
    const d = new Date(item.createdAt)

    // Daily: YYYY-MM-DD
    const dayKey = d.toISOString().split('T')[0]
    dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1)

    // Weekly: Monday of the week (YYYY-MM-DD)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust for Sunday
    const monday = new Date(d)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    const weekKey = monday.toISOString().split('T')[0]
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + 1)

    // Monthly: YYYY-MM
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1)
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const weekly = Array.from(weeklyMap.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  const monthly = Array.from(monthlyMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const response: MemoryStatsResponse = {
    totalCount: totalResult.totalDocs,
    byUser,
    byType,
    averageImportance: Math.round(averageImportance * 100) / 100,
    byDate: { daily, weekly, monthly },
  }

  return Response.json(response)
}
