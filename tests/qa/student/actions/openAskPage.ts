// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Open ask page action handler
 * @fileType action-handler
 * @domain qa
 * @pattern chat-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const openAskPage: ActionHandler = async (ctx) => {
  const { page } = ctx

  await page.goto('/ask')
  await page.waitForLoadState('networkidle')
}
