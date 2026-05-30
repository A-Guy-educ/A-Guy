// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageRange } from '@/ui/web/PageRange'

describe('PageRange', () => {
  it('should NOT show "Search produced no results" message when totalDocs is 0 on a non-search page', () => {
    // Bug reproduction: The posts page shows "Search produced no results" when totalDocs is 0
    // even though there's no search functionality on that page.
    // This test asserts the CORRECT behavior: no search message when isSearch is not set.
    render(<PageRange totalDocs={0} collection="posts" />)
    expect(screen.queryByText('Search produced no results.')).toBeNull()
  })

  it('should NOT show "Search produced no results" message when totalDocs is undefined on a non-search page', () => {
    render(<PageRange totalDocs={undefined} collection="posts" />)
    expect(screen.queryByText('Search produced no results.')).toBeNull()
  })

  it('should show "Search produced no results" message when isSearch is true and totalDocs is 0', () => {
    render(<PageRange totalDocs={0} collection="posts" isSearch={true} />)
    expect(screen.getByText('Search produced no results.')).toBeTruthy()
  })

  it('should show range when totalDocs > 0', () => {
    render(<PageRange totalDocs={25} currentPage={1} limit={12} collection="posts" />)
    expect(screen.getByText(/Showing 1 - 12 of 25 Posts/)).toBeTruthy()
  })
})
