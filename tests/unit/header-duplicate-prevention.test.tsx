// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest'
import { CourseHeader } from '@/app/(frontend)/courses/_components/CourseHeader'
import { ChapterHeader } from '@/app/(frontend)/courses/_components/ChapterHeader'
import { LessonHeader } from '@/app/(frontend)/courses/_components/LessonHeader'
import { normalizeComparableText } from '@/infra/utils/normalizeComparableText'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '@/i18n/en.json'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

// Clean up DOM and mocks after each test
afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeComparableText utility', () => {
  it('normalizes newlines as whitespace', () => {
    expect(normalizeComparableText('גיאומטריה\n')).toBe(normalizeComparableText('גיאומטריה'))
  })

  it('normalizes multiple whitespace and newlines', () => {
    expect(normalizeComparableText('  HELLO\nWORLD  ')).toBe(normalizeComparableText('hello world'))
  })
})

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

    // Hebrew examples
    it('does not render description when Hebrew text matches with extra whitespace', () => {
      const { container } = render(
        <CourseHeader courseLabel="קורס" title="גיאומטריה" description="  גיאומטריה  " />,
      )

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('renders description when Hebrew text differs', () => {
      const result = render(
        <CourseHeader courseLabel="קורס" title="גיאומטריה" description="לימוד צורות וזוויות" />,
      )

      // Check for Hebrew description using container query
      const paragraphs = result.container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(1)
      expect(paragraphs[0].textContent).toBe('לימוד צורות וזוויות')
    })

    it('does not render description with trailing newline', () => {
      const renderComponent = (props: any) =>
        render(
          <I18nProvider locale="en" messages={enMessages}>
            <CourseHeader {...props} />
          </I18nProvider>,
        )

      const { container } = renderComponent({
        courseLabel: 'Course',
        title: 'Test',
        description: 'Test\n',
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    // Trailing punctuation (current behavior - different strings)
    it('renders description when trailing punctuation differs', () => {
      const { container } = render(
        <CourseHeader courseLabel="Course" title="טכניקה אלגברית" description="טכניקה אלגברית." />,
      )

      // Punctuation makes them different, so both should render
      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(1)
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

    // Hebrew examples
    it('does not render description when Hebrew text matches with extra whitespace', () => {
      const { container } = render(<ChapterHeader title="גיאומטריה" description="  גיאומטריה  " />)

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('renders description when Hebrew text differs', () => {
      const result = render(<ChapterHeader title="גיאומטריה" description="לימוד צורות וזוויות" />)

      // Check using container query
      const paragraphs = result.container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(1)
      expect(paragraphs[0].textContent).toBe('לימוד צורות וזוויות')
    })

    it('does not render description with trailing newline', () => {
      const renderComponent = (props: any) =>
        render(
          <I18nProvider locale="en" messages={enMessages}>
            <ChapterHeader {...props} />
          </I18nProvider>,
        )

      const { container } = renderComponent({
        title: 'Test',
        description: 'Test\n',
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    // Trailing punctuation (current behavior - different strings)
    it('renders description when trailing punctuation differs', () => {
      const { container } = render(
        <ChapterHeader title="טכניקה אלגברית" description="טכניקה אלגברית." />,
      )

      // Punctuation makes them different, so both should render
      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(1)
    })
  })

  describe('LessonHeader', () => {
    const renderComponent = (props: any) =>
      render(
        <I18nProvider locale="en" messages={enMessages}>
          <LessonHeader {...props} />
        </I18nProvider>,
      )

    it('renders title and description when they differ', () => {
      const { container } = renderComponent({
        title: 'Introduction to Variables',
        description: 'Learn about variable types',
        lessonOrder: 1,
      })

      expect(screen.getByText('Introduction to Variables')).toBeTruthy()
      expect(screen.getByText('Learn about variable types')).toBeTruthy()
    })

    it('does not render description when identical to title', () => {
      const { container } = renderComponent({
        title: 'Introduction to Variables',
        description: 'Introduction to Variables',
        lessonOrder: 1,
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when normalized text matches', () => {
      const { container } = renderComponent({
        title: 'Introduction to Variables',
        description: '  INTRODUCTION   TO   VARIABLES  ',
        lessonOrder: 1,
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when null', () => {
      const { container } = renderComponent({
        title: 'Introduction to Variables',
        description: null,
        lessonOrder: 1,
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description when undefined', () => {
      const { container } = renderComponent({
        title: 'Introduction to Variables',
        description: undefined,
        lessonOrder: 1,
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })

    it('does not render description with trailing newline', () => {
      const { container } = renderComponent({
        title: 'Test',
        description: 'Test\n',
        lessonOrder: 1,
      })

      const paragraphs = container.querySelectorAll('p.text-xl')
      expect(paragraphs).toHaveLength(0)
    })
  })
})
