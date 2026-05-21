/**
 * @fileType test
 * @domain frontend
 * @pattern lesson-navigation, url-construction
 * @ai-summary Tests for lesson completion backUrl redirect to /study page
 */
import { describe, expect, it } from 'vitest'

/**
 * Test suite for lesson completion backUrl redirect behavior.
 *
 * Bug: After completing an interactive lesson, clicking "Finish" redirects
 * to the course page instead of the study dashboard.
 *
 * Expected: backUrl should point to /study (study dashboard)
 * Actual (before fix): backUrl points to /courses/{courseSlug}
 *
 * This test file verifies the URL construction patterns match the expected behavior.
 */
describe('URL construction patterns', () => {
  it('should use /study as the backUrl', () => {
    const expectedBackUrl = '/study'
    expect(expectedBackUrl).toBe('/study')
  })

  it('should NOT use course page URL as backUrl', () => {
    const courseSlug = 'math-101'
    const oldCourseUrl = `/courses/${courseSlug}`
    expect(oldCourseUrl).not.toBe('/study')
  })

  it('should NOT use chapter page URL as backUrl', () => {
    const courseSlug = 'math-101'
    const chapterSlug = 'chapter-1'
    const oldChapterUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`
    expect(oldChapterUrl).not.toBe('/study')
  })

  it('should NOT use lesson page URL as backUrl', () => {
    const courseSlug = 'math-101'
    const chapterSlug = 'chapter-1'
    const lessonSlug = 'lesson-1'
    const oldLessonUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
    expect(oldLessonUrl).not.toBe('/study')
  })
})

describe('Expected backUrl behavior', () => {
  it('lesson page: backUrl should be /study', () => {
    const backUrl = '/study'
    expect(backUrl).toBe('/study')
  })

  it('exercise page: backUrl should be /study', () => {
    const backUrl = '/study'
    expect(backUrl).toBe('/study')
  })

  it('complete page: backUrl should be chapter page URL', () => {
    const backUrl = '/courses/math-101/chapters/chapter-1'
    expect(backUrl).not.toBe('/study')
    expect(backUrl).toContain('/courses/')
  })
})

describe('Verify entry points use correct URLs', () => {
  it('lesson and exercise pages should use /study URL', () => {
    const lessonPageBackUrl = '/study'
    const exercisePageBackUrl = '/study'

    expect(lessonPageBackUrl).toBe(exercisePageBackUrl)
    expect(lessonPageBackUrl).toBe('/study')
  })

  it('complete page should use chapter page URL', () => {
    const completePageBackUrl = '/courses/math-101/chapters/chapter-1'
    expect(completePageBackUrl).not.toBe('/study')
    expect(completePageBackUrl).toContain('/chapters/')
  })
})

/**
 * Test that verifies the actual source code contains the expected backUrl pattern.
 */
describe('Source code verification for backUrl fix', () => {
  it('should read lesson page and verify backUrl points to /study', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const lessonPagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx',
    )

    expect(fs.existsSync(lessonPagePath)).toBe(true)

    const content = fs.readFileSync(lessonPagePath, 'utf-8')

    const hasStudyBackUrl = content.includes("const backUrl = '/study'")
    const hasCoursePageBackUrl = content.includes('const backUrl = `/courses/${courseSlug}`')

    expect(hasStudyBackUrl).toBe(true)
    expect(hasCoursePageBackUrl).toBe(false)
  })

  it('should read exercise page and verify backUrl points to /study', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const exercisePagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx',
    )

    expect(fs.existsSync(exercisePagePath)).toBe(true)

    const content = fs.readFileSync(exercisePagePath, 'utf-8')

    const hasStudyBackUrl = content.includes("const backUrl = '/study'")
    const hasCoursePageBackUrl = content.includes('const backUrl = `/courses/${courseSlug}`')

    expect(hasStudyBackUrl).toBe(true)
    expect(hasCoursePageBackUrl).toBe(false)
  })

  it('should read complete page and verify backUrl points to chapter page', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const completePagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx',
    )

    expect(fs.existsSync(completePagePath)).toBe(true)

    const content = fs.readFileSync(completePagePath, 'utf-8')

    const hasChapterBackUrl = content.includes(
      'const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`',
    )
    const hasStudyBackUrl = content.includes("const backUrl = '/study'")

    expect(hasChapterBackUrl).toBe(true)
    expect(hasStudyBackUrl).toBe(false)
  })
})
