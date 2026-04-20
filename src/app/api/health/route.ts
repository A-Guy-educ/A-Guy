import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { getPoolStats, type PoolStats } from '@/infra/db/pool-stats'

export const dynamic = 'force-dynamic'

interface HealthResponse {
  ok: boolean
  checks: {
    database: boolean
  }
  version: string
  gitSha: string
  timestamp: string
  pool?: PoolStats
}

export async function GET(): Promise<
  NextResponse<HealthResponse> | NextResponse<{ error: string }>
> {
  const checks = {
    database: false,
  }

  let pool: PoolStats | undefined = undefined

  try {
    const payload = await getPayload({ config: configPromise })
    await payload.find({ collection: 'users', limit: 1, depth: 0 })
    checks.database = true

    // Get pool stats if adapter is available
    const adapter = payload.db as MongooseAdapter
    if (adapter?.connection) {
      pool = getPoolStats(adapter)
    }
  } catch {
    checks.database = false
  }

  const ok = checks.database
  const version = process.env.npm_package_version || 'unknown'
  const gitSha = process.env.GIT_SHA || 'unknown'
  const timestamp = new Date().toISOString()

  return NextResponse.json(
    { ok, checks, version, gitSha, timestamp, pool },
    {
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Health-Check': 'ok',
      },
    },
  )
}

// Simple ping endpoint for load balancers - no expensive operations
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 })
}
