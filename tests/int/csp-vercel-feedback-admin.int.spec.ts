import { describe, it, expect } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

/**
 * CSP Configuration Tests - Issue #1595
 *
 * Tests that Content-Security-Policy headers allow Vercel feedback script
 * to load on /admin routes.
 *
 * Bug: Vercel feedback script (https://vercel.live/_next-live/feedback/feedback.js)
 * is blocked on /admin because vercel.live is not in the script-src directive.
 */

describe('CSP Configuration - Vercel Feedback Script on /admin', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(__dirname, '../..')
  const nextConfigPath = path.join(projectRoot, 'next.config.js')

  // Helper to extract CSP value from headers array
  function extractCSPValue(headers: Array<{ key: string; value: string }>): string | null {
    const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy')
    return cspHeader?.value ?? null
  }

  // Helper to extract script-src directive from CSP string
  function extractScriptSrc(csp: string): string | null {
    const match = csp.match(/script-src\s+([^;]+)/)
    return match ? match[1] : null
  }

  it('should include vercel.live in script-src for general routes', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the general routes CSP (the first one, not /admin/:path*)
    const generalRouteMatch = configContent.match(
      /source:\s*'\/\(\(\?!api\/pdfjs-viewer\)\.\*\)'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(generalRouteMatch).not.toBeNull()

    const csp = generalRouteMatch![1]
    const scriptSrc = extractScriptSrc(csp)

    expect(scriptSrc).not.toBeNull()
    // General routes SHOULD have vercel.live in script-src (this is the baseline)
    expect(scriptSrc).toContain('vercel.live')
  })

  it('should include vercel.live in script-src for /admin routes', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the /admin route CSP
    const adminRouteMatch = configContent.match(
      /source:\s*'\/admin\/:path\*'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(adminRouteMatch).not.toBeNull()

    const csp = adminRouteMatch![1]
    const scriptSrc = extractScriptSrc(csp)

    expect(scriptSrc).not.toBeNull()
    // Admin routes MUST have vercel.live in script-src for Vercel feedback to work
    expect(scriptSrc).toContain('vercel.live')
  })

  it('should include vercel.live in connect-src for /admin routes', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the /admin route CSP
    const adminRouteMatch = configContent.match(
      /source:\s*'\/admin\/:path\*'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(adminRouteMatch).not.toBeNull()

    const csp = adminRouteMatch![1]
    const connectSrcMatch = csp.match(/connect-src\s+([^;]+)/)

    expect(connectSrcMatch).not.toBeNull()
    const connectSrc = connectSrcMatch![1]
    // Admin routes should have vercel.live in connect-src for WebSocket connections
    expect(connectSrc).toContain('vercel.live')
  })
})
