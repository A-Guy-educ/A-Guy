// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Goto action handler - navigates to a specific URL
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const goto: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const url = input?.url as string | undefined

  if (!url) {
    throw new Error('goto action requires url input')
  }

  await page.goto(url)
  await page.waitForLoadState('networkidle')
}
