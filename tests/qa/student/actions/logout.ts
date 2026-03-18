// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Logout action handler
 * Clears auth cookies to log out
 * @fileType action-handler
 * @domain qa
 * @pattern session-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const logout: ActionHandler = async (ctx) => {
  const { page, locale } = ctx
  const _labels = LABELS[locale]

  // Click user dropdown to find logout option
  const userButton = page
    .locator('button')
    .filter({ hasText: /[\u0590-\u05FF\w]/ })
    .first()
  await userButton.click()

  // Find and click logout button
  const logoutButton = page.getByRole('button', { name: labels.logout })
  await logoutButton.click()

  // Clear auth cookie
  await page.context().clearCookies()
}
