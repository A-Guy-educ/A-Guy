/**
 * @fileType test
 * @domain frontend
 * @pattern lesson-navigation, url-routing
 * @ai-summary Verifies that lesson pages navigate to /study after completion
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Lesson Navigation backUrl Fix (Issue #851)', () => {
  /**
   * This test verifies that the backUrl in lesson pages points to /study
   * ensuring users are redirected to the study dashboard after completing
   * a lesson instead of the course page or chapter list view.
   */
  it('lesson page should navigate to /study (not course or chapter page)', () => {
    const lessonPagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx',
    )
    const content = fs.readFileSync(lessonPagePath, 'utf-8')

    expect(content).toContain("const backUrl = '/study'")
    expect(content).not.toContain(
      'const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`',
    )
    expect(content).not.toContain('const backUrl = `/courses/${courseSlug}`')
  })

  it('exercise page should navigate to /study (not course or lesson page)', () => {
    const exercisePagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx',
    )
    const content = fs.readFileSync(exercisePagePath, 'utf-8')

    expect(content).toContain("const backUrl = '/study'")
    expect(content).not.toContain(
      'const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`',
    )
    expect(content).not.toContain('const backUrl = `/courses/${courseSlug}`')
  })

  it('complete page should navigate to /study (not course or lesson page)', () => {
    const completePagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx',
    )
    const content = fs.readFileSync(completePagePath, 'utf-8')

    expect(content).toContain("const backUrl = '/study'")
    expect(content).not.toContain(
      'const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`',
    )
    expect(content).not.toContain('const backUrl = `/courses/${courseSlug}`')
  })

  it('all three lesson navigation pages should use consistent /study URL', () => {
    const basePath =
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]'

    const lessonPage = fs.readFileSync(path.join(process.cwd(), `${basePath}/page.tsx`), 'utf-8')
    const exercisePage = fs.readFileSync(
      path.join(process.cwd(), `${basePath}/exercises/[exerciseSlug]/page.tsx`),
      'utf-8',
    )
    const completePage = fs.readFileSync(
      path.join(process.cwd(), `${basePath}/complete/page.tsx`),
      'utf-8',
    )

    const studyUrlPattern = "const backUrl = '/study'"

    expect(lessonPage).toContain(studyUrlPattern)
    expect(exercisePage).toContain(studyUrlPattern)
    expect(completePage).toContain(studyUrlPattern)
  })
})
