/**
 * GET /api/cron/warmup
 *
 * Vercel cron endpoint to keep serverless functions warm.
 * Fires every 4 minutes to prevent cold starts.
 * This endpoint intentionally does NO heavy work — it just returns fast
 * so the function instance stays allocated.
 *
 * @see vercel.json for cron schedule configuration
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { warm: true, ts: new Date().toISOString() },
    {
      status: 200,
      headers: {
        // Prevent any caching — this must always execute fresh
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Warmup': 'true',
      },
    },
  )
}
