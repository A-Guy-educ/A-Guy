// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Open courses catalog action handler
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const openCourses: ActionHandler = async (ctx) => {
  const { page } = ctx

  await page.goto('courses')
  await page.waitForLoadState('networkidle')
}
