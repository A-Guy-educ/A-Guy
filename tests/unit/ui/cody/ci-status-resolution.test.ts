/**
 * @fileType test
 * @domain cody
 * @pattern ci-status-resolution
 * @ai-summary Reproduction tests for merge button CI status bugs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to mock octokit and env vars before importing the module
vi.mock('@octokit/plugin-throttling', () => ({
  throttling: vi.fn(() => (Octokit: unknown) => Octokit),
}))

// Mock the Octokit constructor
const mockPullsGet = vi.fn()
const mockGetCombinedStatus = vi.fn()
const mockListCheckRuns = vi.fn()

vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    static plugin() {
      return MockOctokit
    }
    pulls = { get: mockPullsGet }
    repos = { getCombinedStatusForRef: mockGetCombinedStatus }
    checks = { listForRef: mockListCheckRuns }
  },
}))

// Set env vars before module import
vi.stubEnv('GITHUB_TOKEN', 'test-token')
vi.stubEnv('CODY_BOT_TOKEN', '')

import { fetchPRCIStatus } from '@/ui/cody/github-client'

describe('fetchPRCIStatus – CI status resolution bugs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear module-level cache by importing fresh
    // The cache is in-memory with 15s TTL, so we use unique PR numbers per test
  })

  it('returns success when main CI passes but a non-essential check run failed', async () => {
    // Setup: mergeable_state = 'blocked' (normal for repos without branch protection)
    mockPullsGet.mockResolvedValue({
      data: {
        mergeable_state: 'blocked',
        mergeable: true,
        head: { sha: 'abc123' },
      },
    })

    // Combined status is success (status API checks pass)
    mockGetCombinedStatus.mockResolvedValue({
      data: {
        state: 'success',
        statuses: [{ state: 'success', context: 'vercel' }],
      },
    })

    // Two check runs: one CI passes, one non-essential fails
    mockListCheckRuns.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'build-and-test',
            status: 'completed',
            conclusion: 'success',
            started_at: '2025-01-01T01:00:00Z',
          },
          {
            name: 'deploy-preview',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2025-01-01T01:00:00Z',
          },
        ],
      },
    })

    const result = await fetchPRCIStatus(9001) // unique PR number to avoid cache
    // BUG: currently returns 'failure' because deploy-preview failed
    // EXPECTED: 'success' because combined status is 'success'
    expect(result.ciStatus).toBe('success')
    expect(result.mergeable).toBe(true)
  })

  it('returns success when a stale failed check run is superseded by a newer successful one', async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        mergeable_state: 'blocked',
        mergeable: true,
        head: { sha: 'def456' },
      },
    })

    mockGetCombinedStatus.mockResolvedValue({
      data: { state: 'success', statuses: [] },
    })

    // Two runs of same check name – old one failed, new one passed
    mockListCheckRuns.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2025-01-01T00:00:00Z',
          },
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            started_at: '2025-01-01T01:00:00Z',
          },
        ],
      },
    })

    const result = await fetchPRCIStatus(9002)
    // BUG: currently returns 'failure' because .some() finds the old failure
    // EXPECTED: 'success' because the latest CI run passed
    expect(result.ciStatus).toBe('success')
    expect(result.mergeable).toBe(true)
  })

  it('returns hasConflicts=true when mergeable_state is dirty', async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        mergeable_state: 'dirty',
        mergeable: false,
        head: { sha: 'ghi789' },
      },
    })

    const result = await fetchPRCIStatus(9003)
    expect(result.ciStatus).toBe('failure')
    expect(result.mergeable).toBe(false)
    // BUG: currently no hasConflicts field
    // EXPECTED: hasConflicts = true so UI can distinguish from CI failure
    expect(result.hasConflicts).toBe(true)
  })

  it('returns hasConflicts=false when CI genuinely fails', async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        mergeable_state: 'blocked',
        mergeable: true,
        head: { sha: 'jkl012' },
      },
    })

    mockGetCombinedStatus.mockResolvedValue({
      data: { state: 'failure', statuses: [{ state: 'failure', context: 'ci/test' }] },
    })

    mockListCheckRuns.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'CI',
            status: 'completed',
            conclusion: 'failure',
            started_at: '2025-01-01T01:00:00Z',
          },
        ],
      },
    })

    const result = await fetchPRCIStatus(9004)
    expect(result.ciStatus).toBe('failure')
    expect(result.mergeable).toBe(false)
    expect(result.hasConflicts).toBe(false)
  })
})
