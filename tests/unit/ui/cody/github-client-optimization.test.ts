/**
 * @fileType test
 * @domain cody
 * @pattern github-client
 * @ai-summary Tests for GitHub API client rate limit optimization changes
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// CACHE_TTL Tests
// ============================================================================

describe('CACHE_TTL', () => {
  it('should have optimized TTL values in constants', () => {
    const constantsContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/constants.ts'),
      'utf-8',
    )
    // Verify the new optimized values are in the file
    expect(constantsContent).toContain('tasks: 120000') // 2min
    expect(constantsContent).toContain('pipeline: 30000') // 30s (was 5s)
    expect(constantsContent).toContain('boards: 300000') // 5min
    expect(constantsContent).toContain('prs: 120000') // 2min (was 30s)
  })
})

// ============================================================================
// Polling Intervals Tests
// ============================================================================

describe('POLLING_INTERVALS', () => {
  it('should have polling intervals defined in constants', () => {
    const constantsContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/constants.ts'),
      'utf-8',
    )
    // Verify polling intervals are defined
    expect(constantsContent).toContain('idle: 30000')
    expect(constantsContent).toContain('board: 10000')
    expect(constantsContent).toContain('active: 5000')
  })
})

// ============================================================================
// fetchIssue Function Export Tests
// ============================================================================

describe('fetchIssue function', () => {
  it('should export fetchIssue function from github-client', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    expect(clientContent).toContain('export async function fetchIssue')
  })
})

// ============================================================================
// Task Detail Route Optimization Tests
// ============================================================================

describe('Task detail route optimization', () => {
  it('should import fetchIssue in task detail route', () => {
    const routeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/cody/tasks/[taskId]/route.ts'),
      'utf-8',
    )
    expect(routeContent).toContain('fetchIssue,')
    expect(routeContent).toContain("from '@/ui/cody/github-client'")
  })

  it('should use optimized path for numeric taskId', () => {
    const routeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/cody/tasks/[taskId]/route.ts'),
      'utf-8',
    )
    // Should check for numeric issue number first
    expect(routeContent).toContain('issueNumberFromUrl')
    // Should call fetchIssue directly (single API call)
    expect(routeContent).toContain('fetchIssue(issueNumberFromUrl)')
  })
})

// ============================================================================
// Octokit Configuration Tests
// ============================================================================

describe('Octokit configuration', () => {
  it('should import Octokit from @octokit/rest', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    expect(clientContent).toContain("import { Octokit } from '@octokit/rest'")
  })

  it('should use singleton pattern for Octokit', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    expect(clientContent).toContain('let octokitInstance: Octokit | null = null')
    expect(clientContent).toContain('if (octokitInstance)')
  })

  it('should use Octokit for GitHub API', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    expect(clientContent).toContain('import { Octokit }')
    expect(clientContent).toContain("from '@octokit/rest'")
  })
})

// ============================================================================
// Dashboard Polling Tests
// ============================================================================

describe('CodyDashboard polling configuration', () => {
  it('should import POLLING_INTERVALS constants', () => {
    const dashboardContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/CodyDashboard.tsx'),
      'utf-8',
    )
    expect(dashboardContent).toContain("import { POLLING_INTERVALS } from '../constants'")
  })

  it('should use getPollingInterval function', () => {
    const dashboardContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/CodyDashboard.tsx'),
      'utf-8',
    )
    expect(dashboardContent).toContain('getPollingInterval')
    expect(dashboardContent).toContain('useCallback')
  })

  it('should have visibility detection for polling', () => {
    const dashboardContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/CodyDashboard.tsx'),
      'utf-8',
    )
    expect(dashboardContent).toContain('document.hidden')
    expect(dashboardContent).toContain('visibilitychange')
  })

  it('should use adaptive polling based on task state', () => {
    const dashboardContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/CodyDashboard.tsx'),
      'utf-8',
    )
    expect(dashboardContent).toContain('hasRunningTasks')
    expect(dashboardContent).toContain('hasActiveTask')
    expect(dashboardContent).toContain('POLLING_INTERVALS.active')
    expect(dashboardContent).toContain('POLLING_INTERVALS.board')
    expect(dashboardContent).toContain('POLLING_INTERVALS.idle')
  })
})

// ============================================================================
// Cache Helper Function Tests
// ============================================================================

describe('Cache helper functions', () => {
  it('should support ETag in cache entries', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    expect(clientContent).toContain('interface CacheEntry')
    expect(clientContent).toContain('etag?: string')
    expect(clientContent).toContain('lastModified?: string')
  })
})
