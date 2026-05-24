import { describe, it, expect } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

/**
 * CSP Configuration Tests - Issue #2040
 *
 * Tests that Content-Security-Policy headers allow Gravatar avatar images
 * to load on /admin routes.
 *
 * Bug: Gravatar image requests (secure.gravatar.com) are blocked on /admin
 * because gravatar.com is not in the img-src directive.
 */

describe('CSP Configuration - Gravatar Images on /admin', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(__dirname, '../..')
  const nextConfigPath = path.join(projectRoot, 'next.config.js')

  // Helper to extract CSP value from headers array
  function extractCSPValue(headers: Array<{ key: string; value: string }>): string | null {
    const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy')
    return cspHeader?.value ?? null
  }

  // Helper to extract img-src directive from CSP string
  function extractImgSrc(csp: string): string | null {
    const match = csp.match(/img-src\s+([^;]+)/)
    return match ? match[1] : null
  }

  it('should include secure.gravatar.com in img-src for /admin routes', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the /admin route CSP
    const adminRouteMatch = configContent.match(
      /source:\s*'\/admin\/:path\*'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(adminRouteMatch).not.toBeNull()

    const csp = adminRouteMatch![1]
    const imgSrc = extractImgSrc(csp)

    expect(imgSrc).not.toBeNull()
    // Admin routes MUST have secure.gravatar.com in img-src for user avatars to work
    expect(imgSrc).toContain('secure.gravatar.com')
  })
})
