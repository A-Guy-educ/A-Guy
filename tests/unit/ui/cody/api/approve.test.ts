/**
 * Unit Tests for Cody Approve API Endpoint
 *
 * Tests the /api/cody/tasks/approve route that approves and merges a PR.
 *
 * These tests verify:
 * - Uses constants from @/ui/cody/constants for GITHUB_OWNER and GITHUB_REPO
 */
import { describe, expect, it } from 'vitest'

describe('POST /api/cody/tasks/approve - Constants', () => {
  it('should import GITHUB_OWNER from constants', async () => {
    const { GITHUB_OWNER } = await import('@/ui/cody/constants')
    expect(GITHUB_OWNER).toBe('A-Guy-educ')
  })

  it('should import GITHUB_REPO from constants', async () => {
    const { GITHUB_REPO } = await import('@/ui/cody/constants')
    expect(GITHUB_REPO).toBe('A-Guy')
  })
})
