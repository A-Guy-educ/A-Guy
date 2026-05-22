/**
 * @fileType unit-test
 * @domain components
 * @pattern page-range
 * @ai-summary Tests for PageRange component
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PageRange } from '@/ui/web/PageRange'

afterEach(() => {
  cleanup()
})

describe('PageRange component', () => {
  describe('render behavior', () => {
    it('shows "Search produced no results." when isSearchResult is true and totalDocs is 0', () => {
      render(<PageRange collection="posts" totalDocs={0} isSearchResult={true} />)
      expect(screen.getByText('Search produced no results.')).toBeTruthy()
    })

    it('does NOT show "Search produced no results." when isSearchResult is false and totalDocs is 0', () => {
      render(<PageRange collection="posts" totalDocs={0} isSearchResult={false} />)
      expect(screen.queryByText('Search produced no results.')).toBeNull()
    })

    it('does NOT show "Search produced no results." when isSearchResult is undefined and totalDocs is 0', () => {
      render(<PageRange collection="posts" totalDocs={0} />)
      expect(screen.queryByText('Search produced no results.')).toBeNull()
    })

    it('shows "Showing X - Y of Z Posts" when totalDocs > 0', () => {
      render(<PageRange collection="posts" totalDocs={25} currentPage={1} limit={12} />)
      expect(screen.getByText(/Showing 1 - 12 of 25 Posts/)).toBeTruthy()
    })

    it('shows "Showing 1 - 5 of 5 Posts" on last partial page', () => {
      render(<PageRange collection="posts" totalDocs={5} currentPage={1} limit={12} />)
      expect(screen.getByText(/Showing 1 - 5 of 5 Posts/)).toBeTruthy()
    })

    it('uses singular form "Post" when totalDocs is 1', () => {
      render(<PageRange collection="posts" totalDocs={1} currentPage={1} limit={12} />)
      expect(screen.getByText(/Showing 1 - 1 of 1 Post/)).toBeTruthy()
    })
  })
})
