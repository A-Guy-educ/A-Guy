// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import React from 'react'

import { PageRange } from '@/ui/web/PageRange'

describe('PageRange', () => {
  describe('when rendered for a list view (isSearch not set)', () => {
    it('shows "No Posts yet" when there are zero posts', () => {
      render(<PageRange collection="posts" currentPage={1} limit={12} totalDocs={0} />)

      expect(screen.getByText('No Posts yet.')).toBeTruthy()
      expect(screen.queryByText('Search produced no results.')).toBeNull()
    })

    it('shows "No Docs yet" when there are zero docs (generic collection)', () => {
      render(
        <PageRange
          collectionLabels={{ plural: 'Docs', singular: 'Doc' }}
          currentPage={1}
          limit={12}
          totalDocs={0}
        />,
      )

      expect(screen.getByText('No Docs yet.')).toBeTruthy()
      expect(screen.queryByText('Search produced no results.')).toBeNull()
    })

    it('shows "No Courses yet" when there are zero courses', () => {
      render(
        <PageRange
          collectionLabels={{ plural: 'Courses', singular: 'Course' }}
          currentPage={1}
          limit={12}
          totalDocs={0}
        />,
      )

      expect(screen.getByText('No Courses yet.')).toBeTruthy()
    })
  })

  describe('when rendered for a search result (isSearch=true)', () => {
    it('shows "Search produced no results" when there are zero results', () => {
      render(
        <PageRange collection="posts" currentPage={1} limit={12} totalDocs={0} isSearch={true} />,
      )

      expect(screen.getByText('Search produced no results.')).toBeTruthy()
      expect(screen.queryByText('No Posts yet.')).toBeNull()
    })
  })

  describe('when there are posts/results', () => {
    it('shows the correct range for posts', () => {
      render(<PageRange collection="posts" currentPage={1} limit={12} totalDocs={25} />)

      expect(screen.getByText('Showing 1 - 12 of 25 Posts')).toBeTruthy()
    })

    it('shows the correct range for second page', () => {
      render(<PageRange collection="posts" currentPage={2} limit={12} totalDocs={25} />)

      expect(screen.getByText('Showing 13 - 24 of 25 Posts')).toBeTruthy()
    })
  })
})
