/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern health-check
 * @ai-summary Health check for the remote dev agent — returns online/offline status
 *
 * Returns 404 if the actor is not configured in REMOTE_DEV_USERS.
 * Uses a 3s timeout to keep the UI responsive.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDashboardAuth } from '@/ui/cody/auth'
import { getRemoteConfig } from '@/ui/cody/remote-config'
import { logger } from '@/infra/utils/logger/logger'

export const runtime = 'nodejs'

const STATUS_TIMEOUT_MS = 3_000

export async function GET(req: NextRequest) {
  try {
    const auth = await requireDashboardAuth(req)
    if (!auth.authenticated) {
      return NextResponse.json(
        { message: 'Not authenticated. Please log in to access the dashboard.' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(req.url)
    const actorLogin = searchParams.get('actorLogin')

    if (!actorLogin) {
      return NextResponse.json({ error: 'actorLogin query param is required' }, { status: 400 })
    }

    const remoteConfig = getRemoteConfig(actorLogin)
    if (!remoteConfig) {
      return NextResponse.json({ configured: false, online: false }, { status: 404 })
    }

    const healthUrl = `${remoteConfig.funnelUrl.replace(/\/$/, '')}/health`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)

      let online = false
      try {
        const res = await fetch(healthUrl, { signal: controller.signal })
        online = res.ok
      } finally {
        clearTimeout(timeoutId)
      }

      return NextResponse.json({
        configured: true,
        online,
        funnelUrl: remoteConfig.funnelUrl,
      })
    } catch {
      return NextResponse.json({
        configured: true,
        online: false,
        funnelUrl: remoteConfig.funnelUrl,
      })
    }
  } catch (error) {
    logger.error({ err: error }, 'Remote status route error')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
