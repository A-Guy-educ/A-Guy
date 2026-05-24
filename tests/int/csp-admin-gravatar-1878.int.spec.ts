import { describe, it, expect } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

/**
 * CSP Configuration Tests - Issue #1878
 *
 * Tests that Content-Security-Policy headers allow Gravatar avatars
 * to load on /admin routes.
 *
 * Bug: Gravatar avatars (https://www.gravatar.com/avatar/...) are blocked
 * on /admin because www.gravatar.com is not in the img-src directive.
 */

describe('CSP Configuration - Gravatar Avatars on /admin', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(__dirname, '../..')
  const nextConfigPath = path.join(projectRoot, 'next.config.js')

  // Helper to extract img-src directive from CSP string
  function extractImgSrc(csp: string): string | null {
    const match = csp.match(/img-src\s+([^;]+)/)
    return match ? match[1] : null
  }

  it('should include www.gravatar.com in img-src for /admin routes', async () => {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8')

    // Extract the /admin route CSP
    const adminRouteMatch = configContent.match(
      /source:\s*'\/admin\/:path\*'[\s\S]*?Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/,
    )
    expect(adminRouteMatch).not.toBeNull()

    const csp = adminRouteMatch![1]
    const imgSrc = extractImgSrc(csp)

    expect(imgSrc).not.toBeNull()
    // Admin routes MUST have www.gravatar.com in img-src for user avatars to load
    expect(imgSrc).toContain('www.gravatar.com')
  })
})
