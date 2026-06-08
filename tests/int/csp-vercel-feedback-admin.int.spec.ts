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

  it('should include gravatar.com in img-src for /admin routes', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the /admin route CSP
    const adminRouteMatch = configContent.match(
      /source:\s*'\/admin\/:path\*'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(adminRouteMatch).not.toBeNull()

    const csp = adminRouteMatch![1]
    const imgSrcMatch = csp.match(/img-src\s+([^;]+)/)

    expect(imgSrcMatch).not.toBeNull()
    const imgSrc = imgSrcMatch![1]
    // Admin routes MUST have gravatar.com in img-src for user avatars to load
    // Use *.gravatar.com to match www.gravatar.com where avatars are actually served
    expect(imgSrc).toContain('*.gravatar.com')
  })

  it('should allow www.gravatar.com in img-src for /admin routes (not just gravatar.com)', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the /admin route CSP
    const adminRouteMatch = configContent.match(
      /source:\s*'\/admin\/:path\*'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(adminRouteMatch).not.toBeNull()

    const csp = adminRouteMatch![1]
    const imgSrcMatch = csp.match(/img-src\s+([^;]+)/)

    expect(imgSrcMatch).not.toBeNull()
    const imgSrc = imgSrcMatch![1]
    // Gravatar avatars are served from www.gravatar.com, not gravatar.com directly.
    // In CSP, 'gravatar.com' does NOT match 'www.gravatar.com' (different host).
    // We need '*.gravatar.com' to match subdomains like www.gravatar.com.
    // See: https://www.w3.org/TR/CSP/#source-list-syntax
    expect(imgSrc).toMatch(/\*\.gravatar\.com/)
  })
})
