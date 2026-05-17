/**
 * GET /api/cron/warmup
 *
 * Vercel cron endpoint to keep the serverless backend warm.
 * Fires every 4 minutes to prevent cold starts.
 *
 * It does NOT just return fast — it initializes Payload and runs one
 * tiny read so the Mongo Atlas connection pool, Mongoose model
 * compilation, and Payload config stay hot. This is what prevents the
 * minute-long first login (Atlas TLS+auth handshake + Payload init on
 * the cold path), which a no-op ping never addressed.
 *
 * @see vercel.json for cron schedule configuration
 */
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@payload-config'

export const dynamic = 'force-dynamic'

const WARM_HEADERS = {
  // Prevent any caching — this must always execute fresh
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Warmup': 'true',
} as const

export async function GET() {
  const startedAt = Date.now()

  try {
    const payload = await getPayload({ config })

    // Cheapest possible round-trip to Atlas: forces the connection pool
    // to stay alive and Mongoose models to stay compiled.
    await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      pagination: false,
    })

    return NextResponse.json(
      { warm: true, db: true, ms: Date.now() - startedAt, ts: new Date().toISOString() },
      { status: 200, headers: WARM_HEADERS },
    )
  } catch (error) {
    // Never fail the cron — a degraded warmup is still better than none,
    // and a 500 here would just create noise in monitoring.
    console.error('[warmup] failed to warm Payload/DB:', error)

    return NextResponse.json(
      { warm: true, db: false, ms: Date.now() - startedAt, ts: new Date().toISOString() },
      { status: 200, headers: WARM_HEADERS },
    )
  }
}
