// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourseHeader } from '@/app/(frontend)/courses/_components/CourseHeader'
import { ChapterHeader } from '@/app/(frontend)/courses/_components/ChapterHeader'

describe('Header duplicate prevention', () => {
  describe('CourseHeader', () => {
    it('renders title and description when they differ', () => {
      render(
        <CourseHeader
          courseLabel="Course"
          title="Introduction to Programming"
          description="Learn the basics of programming"
        />,
      )

      expect(screen.getByText('Introduction to Programming')).toBeTruthy()
      expect(screen.getByText('Learn the basics of programming')).toBeTruthy()
    })

    it('does not render description when identical to title', () => {
      const { container } = render(
        <CourseHeader
          courseLabel="Course"
          title="Introduction to Programming"
          description="Introduction to Programming"
        />,
      )

      // Should only have h1, not the description p tag
      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when normalized text matches', () => {
      const { container } = render(
        <CourseHeader
          courseLabel="Course"
          title="Introduction to Programming"
          description="  INTRODUCTION   TO   PROGRAMMING  "
        />,
      )

      // Should not render description paragraph
      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('renders description when it differs after normalization', () => {
      const { container } = render(
        <CourseHeader
          courseLabel="Course"
          title="Advanced Programming"
          description="  advanced   programming   concepts  "
        />,
      )

      expect(screen.getByText('Advanced Programming')).toBeTruthy()
      // Description should render because content differs
      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(1)
    })

    it('does not render description when null', () => {
      const { container } = render(
        <CourseHeader
          courseLabel="Course"
          title="Introduction to Programming"
          description={null}
        />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when undefined', () => {
      const { container } = render(
        <CourseHeader
          courseLabel="Course"
          title="Introduction to Programming"
          description={undefined}
        />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })
  })

  describe('ChapterHeader', () => {
    it('renders title and description when they differ', () => {
      render(
        <ChapterHeader
          title="Variables and Data Types"
          description="Understanding basic concepts"
        />,
      )

      expect(screen.getByText('Variables and Data Types')).toBeTruthy()
      expect(screen.getByText('Understanding basic concepts')).toBeTruthy()
    })

    it('does not render description when identical to title', () => {
      const { container } = render(
        <ChapterHeader title="Variables and Data Types" description="Variables and Data Types" />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when normalized text matches', () => {
      const { container } = render(
        <ChapterHeader
          title="Variables and Data Types"
          description="  VARIABLES   AND   DATA   TYPES  "
        />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('renders description when it differs after normalization', () => {
      const { container } = render(
        <ChapterHeader
          title="Variables and Data Types"
          description="  Understanding   Variables  "
        />,
      )

      // Description should render because content differs
      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(1)
      expect(paragraphs[0].textContent).toContain('Understanding')
    })

    it('does not render description when null', () => {
      const { container } = render(
        <ChapterHeader title="Variables and Data Types" description={null} />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when undefined', () => {
      const { container } = render(
        <ChapterHeader title="Variables and Data Types" description={undefined} />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })
  })
})
