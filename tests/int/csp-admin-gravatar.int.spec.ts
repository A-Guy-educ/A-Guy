/**
 * Integration tests for CSP img-src directive on admin routes
 *
 * Verifies that Gravatar is allowed in the Content-Security-Policy img-src
 * directive for /admin routes, so user avatars can load properly.
 *
 * @fileType integration-test
 * @domain infra.csp
 * @issue #1594
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('CSP Headers - Admin Routes', () => {
  const getNextConfigContent = () => {
    return readFileSync('./next.config.js', 'utf-8')
  }

  const extractAdminCSPHeader = (configContent: string): string | null => {
    // Find the admin route block and extract the CSP value
    // Looking for: source: '/admin/:path*' ... key: 'Content-Security-Policy', value: "..."
    const adminBlockMatch = configContent.match(
      /source:\s*['"]\/admin\/:path\*['"][\s\S]*?key:\s*['"]Content-Security-Policy['"][\s\S]*?value:\s*"([^"]+)["']/,
    )

    if (adminBlockMatch) {
      return adminBlockMatch[1]
    }
    return null
  }

  const extractImgSrcDirective = (cspHeader: string): string | null => {
    const imgSrcMatch = cspHeader.match(/img-src\s+([^;]+);?/)
    if (imgSrcMatch) {
      return imgSrcMatch[1]
    }
    return null
  }

  it('should include gravatar.com in img-src directive for admin routes', () => {
    const configContent = getNextConfigContent()
    const adminCSP = extractAdminCSPHeader(configContent)

    expect(adminCSP).not.toBeNull()

    const imgSrc = extractImgSrcDirective(adminCSP!)
    expect(imgSrc).not.toBeNull()

    // gravatar.com should be allowed for user avatars
    // Note: secure.gravatar.com is the primary CDN, but www.gravatar.com also works
    expect(imgSrc).toMatch(/gravatar\.com|secure\.gravatar\.com|www\.gravatar\.com/)
  })
})
