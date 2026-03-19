// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Open home page action handler
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const openHome: ActionHandler = async (ctx) => {
  const { page } = ctx

  await page.goto('/')
  await page.waitForLoadState('networkidle')
}
