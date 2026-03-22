// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Start as guest action handler
 * Clears auth cookies to act as guest
 * @fileType action-handler
 * @domain qa
 * @pattern session-actions
 */
import type { ActionContext, ActionHandler } from './types'

export const startAsGuest: ActionHandler = async (ctx) => {
  const { page } = ctx

  // Clear all auth cookies
  await page.context().clearCookies()
}
