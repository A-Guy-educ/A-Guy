// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourseHeader } from '@/app/(frontend)/courses/_components/CourseHeader'
import { ChapterHeader } from '@/app/(frontend)/courses/_components/ChapterHeader'

describe('Header Duplicate Prevention', () => {
  describe('CourseHeader', () => {
    it('should show description when different from title', () => {
      const { container } = render(
        <CourseHeader courseLabel="Course" title="Introduction" description="Learn the basics" />,
      )
      const description = container.querySelector('p.text-muted-foreground')
      expect(description).toBeTruthy()
      expect(description?.textContent).toBe('Learn the basics')
    })

    it('should hide description when identical to title', () => {
      const { container } = render(
        <CourseHeader courseLabel="Course" title="Introduction" description="Introduction" />,
      )
      const description = container.querySelector('p.text-muted-foreground')
      expect(description).toBeNull()
    })

    it('should show description when only case differs', () => {
      const { container } = render(
        <CourseHeader courseLabel="Course" title="Introduction" description="  INTRODUCTION  " />,
      )
      const description = container.querySelector('p.text-muted-foreground')
      expect(description).toBeTruthy()
      expect(description?.textContent).toBe('  INTRODUCTION  ')
    })
  })

  describe('ChapterHeader', () => {
    it('should show description when different from title', () => {
      const { container } = render(
        <ChapterHeader title="Chapter One" description="First chapter content" />,
      )
      const description = container.querySelector('p.text-muted-foreground')
      expect(description).toBeTruthy()
      expect(description?.textContent).toBe('First chapter content')
    })

    it('should hide description when identical to title', () => {
      const { container } = render(<ChapterHeader title="Chapter One" description="Chapter One" />)
      const description = container.querySelector('p.text-muted-foreground')
      expect(description).toBeNull()
    })

    it('should show description when only case differs', () => {
      const { container } = render(
        <ChapterHeader title="Chapter One" description="  chapter one  " />,
      )
      const description = container.querySelector('p.text-muted-foreground')
      expect(description).toBeTruthy()
      expect(description?.textContent).toBe('  chapter one  ')
    })
  })
})
