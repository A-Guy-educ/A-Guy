/**
 * Unit Tests for Cody Publish API Endpoint
 *
 * Tests the /api/cody/publish route that creates a GitHub issue with 'publish' label
 * to trigger the dev→main PR workflow.
 *
 * These tests verify:
 * - Uses constants from @/ui/cody/constants for OWNER, REPO, DEV_BRANCH, PROD_BRANCH
 */
import { describe, expect, it } from 'vitest'

describe('POST /api/cody/publish - Constants', () => {
  it('should import GITHUB_OWNER from constants', async () => {
    const { GITHUB_OWNER } = await import('@/ui/cody/constants')
    expect(GITHUB_OWNER).toBe('A-Guy-educ')
  })

  it('should import GITHUB_REPO from constants', async () => {
    const { GITHUB_REPO } = await import('@/ui/cody/constants')
    expect(GITHUB_REPO).toBe('A-Guy')
  })

  it('should import DEV_BRANCH from constants', async () => {
    const { DEV_BRANCH } = await import('@/ui/cody/constants')
    expect(DEV_BRANCH).toBe('dev')
  })

  it('should import PROD_BRANCH from constants', async () => {
    const { PROD_BRANCH } = await import('@/ui/cody/constants')
    expect(PROD_BRANCH).toBe('main')
  })
})
