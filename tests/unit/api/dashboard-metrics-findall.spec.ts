/**
 * Unit tests: findAll parallel pagination
 *
 * Verifies that findAll fetches pages in parallel rather than sequentially.
 * The sequential version takes N * pageDelay ms; the parallel version takes ~pageDelay ms.
 *
 * @see src/app/api/admin/dashboard-metrics/route.ts
 */

import { describe, expect, it } from 'vitest'

// Import the ACTUAL findAll from the utility (parallel implementation)
import { findAll } from '@/server/utils/pagination'

describe('findAll (from route.ts)', () => {
  const pageDelay = 100 // ms — simulates network/db latency per page

  function makeMockFetchPage(totalDocs: number, docsPerPage: number) {
    const callTimes: number[] = []

    const fetchPage = async (
      page: number,
    ): Promise<{ docs: string[]; hasNextPage: boolean; totalPages: number }> => {
      const start = Date.now()
      callTimes.push(start)
      await new Promise((r) => setTimeout(r, pageDelay))

      const totalPages = Math.ceil(totalDocs / docsPerPage)
      const docStart = (page - 1) * docsPerPage
      const docEnd = Math.min(docStart + docsPerPage, totalDocs)
      const docs = Array.from({ length: docEnd - docStart }, (_, i) => `doc-${docStart + i + 1}`)

      return {
        docs,
        hasNextPage: page < totalPages,
        totalPages,
      }
    }

    return { fetchPage, getCallTimes: () => callTimes }
  }

  describe('parallel (fixed) implementation', () => {
    it('completes fast with many pages by fetching in parallel', async () => {
      // 5 pages × 100ms = ≥500ms for sequential, but ~100-200ms for parallel
      const { fetchPage } = makeMockFetchPage(50, 10)

      const start = Date.now()
      const results = await findAll(fetchPage)
      const elapsed = Date.now() - start

      expect(results).toHaveLength(50)
      // Parallel: ~100ms (one batch) vs sequential: ≥500ms (five sequential pages)
      expect(elapsed).toBeLessThan(250)
    })
  })
})
