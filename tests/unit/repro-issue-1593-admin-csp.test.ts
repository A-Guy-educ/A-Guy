/**
 * Unit test: Admin Dashboard CSP Configuration - Repro for #1593
 *
 * Issue: Admin dashboard content fails to render, stuck on loading state
 * Root cause: CSP headers block Gravatar images (user avatars in Payload admin)
 *
 * The CSP for /admin routes is missing:
 * - img-src: *.gravatar.com (for user avatars in Payload admin sidebar)
 *
 * This test verifies the CSP configuration in next.config.js includes the
 * required external resources.
 */

import { describe, expect, it } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Admin Dashboard CSP Configuration (#1593)', () => {
  /**
   * Parses the CSP header value from next.config.js and extracts the img-src directive.
   */
  function extractAdminCSP(configContent: string): string | null {
    // Find the admin route headers section
    const adminRouteMatch = configContent.match(
      /source:\s*['"]\/admin\/:path\*['"][\s\S]*?headers:\s*\[[\s\S]*?\{[\s\S]*?value:\s*`([^`]+)`/,
    )

    if (!adminRouteMatch) {
      // Try alternative pattern
      const altMatch = configContent.match(
        /admin\/:path\*[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*\n?\s*"([^"]+)"/,
      )
      if (altMatch) {
        return altMatch[1]
      }
      return null
    }

    return adminRouteMatch[1] || null
  }

  it('next.config.js contains admin route CSP configuration', async () => {
    // Read next.config.js
    const configPath = path.resolve(__dirname, '../..', 'next.config.js')
    const { readFileSync } = await import('node:fs')
    const configContent = readFileSync(configPath, 'utf-8')

    // Verify admin route CSP exists
    expect(configContent).toContain('/admin/:path*')
    expect(configContent).toContain('Content-Security-Policy')
  })

  it('admin route CSP includes img-src directive', async () => {
    const configPath = path.resolve(__dirname, '../..', 'next.config.js')
    const { readFileSync } = await import('node:fs')
    const configContent = readFileSync(configPath, 'utf-8')

    // The admin CSP should have img-src
    expect(configContent).toContain("img-src 'self'")
  })

  /**
   * CRITICAL TEST: Verifies the admin route CSP allows Gravatar images.
   *
   * Payload admin displays user avatars using Gravatar URLs.
   * Without *.gravatar.com in img-src, these requests are blocked by CSP,
   * causing CSP errors in the browser console and potentially preventing
   * the admin dashboard from rendering properly.
   *
   * This test will FAIL until the fix is applied to next.config.js.
   */
  it('admin route CSP allows Gravatar images (img-src *.gravatar.com)', async () => {
    const configPath = path.resolve(__dirname, '../..', 'next.config.js')
    const { readFileSync } = await import('node:fs')
    const configContent = readFileSync(configPath, 'utf-8')

    // Extract the admin route CSP value
    const adminCSP = extractAdminCSP(configContent)

    expect(adminCSP).not.toBeNull()

    // Parse img-src directive from CSP
    const imgSrcMatch = adminCSP?.match(/img-src\s+([^;]+)/)
    expect(imgSrcMatch).not.toBeNull()

    const imgSrcDirective = imgSrcMatch?.[1] || ''

    // The critical assertion: img-src must include *.gravatar.com
    // This is the core of bug #1593
    expect(imgSrcDirective).toContain('*.gravatar.com')
  })

  /**
   * Verifies the admin route CSP allows Vercel feedback script.
   *
   * The Vercel feedback widget (feedback-react.vercel.app) may be used
   * for user feedback collection in the admin panel.
   */
  it('admin route CSP allows Vercel feedback script', async () => {
    const configPath = path.resolve(__dirname, '../..', 'next.config.js')
    const { readFileSync } = await import('node:fs')
    const configContent = readFileSync(configPath, 'utf-8')

    // Extract the admin route CSP value
    const adminCSP = extractAdminCSP(configContent)

    expect(adminCSP).not.toBeNull()

    // Parse script-src directive from CSP
    const scriptSrcMatch = adminCSP?.match(/script-src\s+([^;]+)/)
    expect(scriptSrcMatch).not.toBeNull()

    const scriptSrcDirective = scriptSrcMatch?.[1] || ''

    // Should allow vercel.live or related Vercel domains
    expect(scriptSrcDirective).toMatch(/vercel/)
  })
})
