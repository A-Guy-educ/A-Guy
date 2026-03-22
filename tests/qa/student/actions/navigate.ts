// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Navigate action handler - unified navigation to pages
 * Replaces: openHome, openCourses, openCourse, openLesson, openAskPage, goto
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 * @normalized
 */
import type { ActionHandler } from './types'

type NavigateInput =
  | { type: 'home' }
  | { type: 'courses' }
  | { type: 'course'; courseRef: string }
  | { type: 'lesson'; courseRef: string; chapterRef: string; lessonRef: string }
  | { type: 'ask' }
  | { type: 'url'; url: string }

function getRefSlug(refs: Record<string, unknown>, refInput: unknown): string {
  if (typeof refInput === 'string') {
    const key = refInput.startsWith('$') ? refInput.slice(1) : refInput
    const found = refs[key] as { slug?: string } | undefined
    if (!found?.slug) throw new Error(`Ref "${refInput}" not found or missing slug`)
    return found.slug
  }
  if (typeof refInput === 'object' && refInput !== null) {
    return (refInput as { slug: string }).slug
  }
  throw new Error(`Invalid ref: ${refInput}`)
}

export const navigate: ActionHandler = async (ctx, input) => {
  const { page, refs } = ctx

  if (!input || !('type' in input)) {
    throw new Error('navigate action requires input with type property')
  }

  const navInput = input as NavigateInput
  let url: string

  switch (navInput.type) {
    case 'home':
      url = '/'
      break

    case 'courses':
      url = '/courses'
      break

    case 'course': {
      const courseSlug = getRefSlug(refs, navInput.courseRef)
      url = `/courses/${courseSlug}`
      break
    }

    case 'lesson': {
      const courseSlug = getRefSlug(refs, navInput.courseRef)
      const chapterSlug = getRefSlug(refs, navInput.chapterRef)
      const lessonSlug = getRefSlug(refs, navInput.lessonRef)
      url = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
      break
    }

    case 'ask':
      url = '/ask'
      break

    case 'url':
      url = navInput.url
      break

    default:
      throw new Error(`Unknown navigate type: ${(navInput as { type: string }).type}`)
  }

  await page.goto(url)
  await page.waitForLoadState('networkidle')
}
