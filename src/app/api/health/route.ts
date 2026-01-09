import { NextResponse } from 'next/server'

/**
 * Health check endpoint for Playwright and monitoring tools
 *
 * This endpoint is designed to be:
 * - Fast (< 10ms response time)
 * - No database queries
 * - No Payload initialization
 * - No dynamic APIs (headers, cookies, draftMode)
 * - Always available as a dynamic route
 *
 * Used by:
 * - Playwright webServer health checks
 * - CI/CD monitoring
 * - Load balancer health checks
 */
export const dynamic = 'force-dynamic' // Explicitly mark as dynamic to avoid static generation issues

export async function GET() {
  // Simple, fast response - no database, no Payload, no dynamic APIs
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
    },
    { status: 200 },
  )
}
