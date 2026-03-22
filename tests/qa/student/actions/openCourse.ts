// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Open specific course action handler
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const openCourse: ActionHandler = async (ctx, input) => {
  const { page, refs } = ctx
  const courseRefInput = input?.courseRef

  if (!courseRefInput) {
    throw new Error('openCourse action requires courseRef input')
  }

  // Get the actual ref key (could be string like "$course" or already resolved object)
  const getRef = (refInput: unknown, _name: string): { slug: string } => {
    if (typeof refInput === 'string') {
      // String reference like "$course"
      const key = refInput.startsWith('$') ? refInput.slice(1) : refInput
      const found = refs[key] as { slug: string } | undefined
      if (!found) throw new Error(`Course ref "${refInput}" not found or missing slug`)
      return found
    }
    // Already resolved object
    return refInput as { slug: string }
  }

  const courseData = getRef(courseRefInput, 'course')

  await page.goto(`/courses/${courseData.slug}`)
  await page.waitForLoadState('networkidle')
}
