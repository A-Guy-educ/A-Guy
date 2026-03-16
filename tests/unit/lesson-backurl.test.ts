/**
 * @fileType test
 * @domain frontend
 * @pattern navigation, lesson-completion
 * @ai-summary Test that LessonPage backUrl points to the lesson page, not the chapter page
 */

import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('LessonPage backUrl', () => {
  const LESSON_PAGE_PATH = path.resolve(
    __dirname,
    '../../src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx',
  )

  it('should point to the lesson page, not the chapter page', () => {
    // Read the page.tsx file
    const fileContent = fs.readFileSync(LESSON_PAGE_PATH, 'utf-8')

    // Extract the backUrl line
    const backUrlMatch = fileContent.match(/const\s+backUrl\s*=\s*`([^`]+)`/)

    expect(backUrlMatch).toBeTruthy()
    const backUrlPattern = backUrlMatch![1]

    // The backUrl should include /lessons/ segment to point to the lesson page
    expect(backUrlPattern).toContain('lessons')

    // Verify the pattern matches: /courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}
    expect(backUrlPattern).toMatch(/\$\{courseSlug\}.*\$\{chapterSlug\}.*\$\{lessonSlug\}/)

    // The backUrl should NOT be just the chapter page (without /lessons/)
    const incorrectPattern = '/courses/${courseSlug}/chapters/${chapterSlug}'
    expect(backUrlPattern).not.toBe(incorrectPattern)
  })

  it('should be consistent with ExercisePage backUrl pattern', () => {
    const lessonPageContent = fs.readFileSync(LESSON_PAGE_PATH, 'utf-8')

    const exercisePagePath = path.resolve(
      __dirname,
      '../../src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx',
    )
    const exercisePageContent = fs.readFileSync(exercisePagePath, 'utf-8')

    // Extract backUrl from both
    const lessonBackUrl = lessonPageContent.match(/const\s+backUrl\s*=\s*`([^`]+)`/)?.[1]
    const exerciseBackUrl = exercisePageContent.match(/const\s+backUrl\s*=\s*`([^`]+)`/)?.[1]

    expect(lessonBackUrl).toBeTruthy()
    expect(exerciseBackUrl).toBeTruthy()

    // Both should contain /lessons/ segment
    expect(lessonBackUrl).toContain('lessons')
    expect(exerciseBackUrl).toContain('lessons')
  })

  it('should be consistent with CompletePage backUrl pattern', () => {
    const lessonPageContent = fs.readFileSync(LESSON_PAGE_PATH, 'utf-8')

    const completePagePath = path.resolve(
      __dirname,
      '../../src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx',
    )
    const completePageContent = fs.readFileSync(completePagePath, 'utf-8')

    // Extract backUrl from both
    const lessonBackUrl = lessonPageContent.match(/const\s+backUrl\s*=\s*`([^`]+)`/)?.[1]
    const completeBackUrl = completePageContent.match(/const\s+backUrl\s*=\s*`([^`]+)`/)?.[1]

    expect(lessonBackUrl).toBeTruthy()
    expect(completeBackUrl).toBeTruthy()

    // Both should contain /lessons/ segment
    expect(lessonBackUrl).toContain('lessons')
    expect(completeBackUrl).toContain('lessons')
  })
})
