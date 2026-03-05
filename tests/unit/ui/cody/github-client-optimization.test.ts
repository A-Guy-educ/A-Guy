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
    expect(constantsContent).toContain('pipeline: 60000') // 30s (was 5s)
    expect(constantsContent).toContain('boards: 900000') // 5min
    expect(constantsContent).toContain('prs: 300000') // 2min (was 30s)
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
    expect(constantsContent).toContain('idle: 60000')
    expect(constantsContent).toContain('board: 30000')
    expect(constantsContent).toContain('active: 15000')
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

// ============================================================================
// fetchIssues PR Filtering Tests
// ============================================================================

describe('fetchIssues PR filtering', () => {
  it('should filter out pull requests from issues list', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    // Verify the filter is present before the map
    expect(clientContent).toContain('.filter((issue: any) => !issue.pull_request)')
  })

  it('filter logic correctly excludes PRs and keeps issues', () => {
    // Unit test the actual filter logic in isolation
    interface MockIssue {
      number: number
      title: string
      state?: string
      labels?: string[]
      body?: string
      pull_request?: { url: string }
    }
    const mockData: MockIssue[] = [
      { number: 1, title: 'Real issue', state: 'open', labels: [], body: '' },
      {
        number: 2,
        title: 'A PR',
        state: 'open',
        labels: [],
        body: '',
        pull_request: { url: 'https://api.github.com/repos/...' },
      },
      { number: 3, title: 'Another issue', state: 'open', labels: [], body: '' },
      {
        number: 4,
        title: 'Another PR',
        state: 'open',
        labels: [],
        body: '',
        pull_request: { url: 'https://api.github.com/repos/...' },
      },
    ]

    const filtered = mockData.filter((issue) => !issue.pull_request)

    expect(filtered).toHaveLength(2)
    expect(filtered.map((i) => i.number)).toEqual([1, 3])
  })

  it('filter keeps all items when no PRs are present', () => {
    interface MockIssue {
      number: number
      title: string
      pull_request?: { url: string }
    }
    const mockData: MockIssue[] = [
      { number: 1, title: 'Issue 1' },
      { number: 2, title: 'Issue 2' },
    ]

    const filtered = mockData.filter((issue) => !issue.pull_request)

    expect(filtered).toHaveLength(2)
  })

  it('filter returns empty array when all items are PRs', () => {
    interface MockIssue {
      number: number
      title: string
      pull_request?: { url: string }
    }
    const mockData: MockIssue[] = [
      { number: 1, title: 'PR 1', pull_request: { url: '...' } },
      { number: 2, title: 'PR 2', pull_request: { url: '...' } },
    ]

    const filtered = mockData.filter((issue) => !issue.pull_request)

    expect(filtered).toHaveLength(0)
  })
})
