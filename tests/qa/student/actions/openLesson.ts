// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Open lesson action handler
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const openLesson: ActionHandler = async (ctx, input) => {
  const { page, refs } = ctx
  const courseRefInput = input?.courseRef
  const chapterRefInput = input?.chapterRef
  const lessonRefInput = input?.lessonRef

  if (!courseRefInput || !chapterRefInput || !lessonRefInput) {
    throw new Error('openLesson action requires courseRef, chapterRef, and lessonRef inputs')
  }

  // Get the actual ref key (could be string like "$course" or already resolved object)
  const getRef = (refInput: unknown, _name: string): { slug: string } => {
    if (typeof refInput === 'string') {
      // String reference like "$course"
      const key = refInput.startsWith('$') ? refInput.slice(1) : refInput
      const found = refs[key] as { slug: string } | undefined
      if (!found) throw new Error(`Ref ${name} not found: ${key}`)
      return found
    }
    // Already resolved object
    return refInput as { slug: string }
  }

  const course = getRef(courseRefInput, 'course')
  const chapter = getRef(chapterRefInput, 'chapter')
  const lesson = getRef(lessonRefInput, 'lesson')

  if (!course?.slug || !chapter?.slug || !lesson?.slug) {
    console.log('Course:', course)
    console.log('Chapter:', chapter)
    console.log('Lesson:', lesson)
    throw new Error('One or more refs missing required slugs')
  }

  await page.goto(`/courses/${course.slug}/chapters/${chapter.slug}/lessons/${lesson.slug}`)
  await page.waitForLoadState('networkidle')
}
