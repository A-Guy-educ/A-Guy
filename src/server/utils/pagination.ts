/**
 * Pagination utilities for fetching all pages of a collection.
 */

/**
 * Fetch every matching doc via pagination — used for queries that need to
 * process all results in-process (e.g. for aggregation). Returns a flat array
 * of docs across all pages.
 *
 * Pages are fetched in parallel batches for performance (concurrency=5).
 */
export async function findAll<T>(
  fetchPage: (page: number) => Promise<{ docs: T[]; hasNextPage: boolean; totalPages: number }>,
): Promise<T[]> {
  // Fetch first page to determine total
  const firstPage = await fetchPage(1)
  if (!firstPage.hasNextPage) return firstPage.docs

  const totalPages = firstPage.totalPages
  const results: T[] = firstPage.docs

  // Cap at 20 pages as a safety net against runaway loops
  const maxPages = 20
  const remaining = Math.min(totalPages - 1, maxPages - 1)
  if (remaining <= 0) return results

  // Fetch remaining pages in parallel batches (concurrency=5)
  const concurrency = 5
  const pageNumbers = Array.from({ length: remaining }, (_, i) => i + 2)

  for (let i = 0; i < pageNumbers.length; i += concurrency) {
    const batch = pageNumbers.slice(i, i + concurrency)
    const pages = await Promise.all(batch.map((p) => fetchPage(p)))
    for (const page of pages) {
      results.push(...page.docs)
    }
  }

  return results
}
