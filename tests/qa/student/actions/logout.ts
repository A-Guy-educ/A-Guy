// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Logout action handler
 * Clears auth cookies to log out
 * @fileType action-handler
 * @domain qa
 * @pattern session-actions
 */
import type { ActionHandler } from './types'

export const logout: ActionHandler = async (ctx) => {
  const { page } = ctx

  // Click user dropdown trigger to open the menu
  const userDropdown = page.getByTestId('user-dropdown')
  await userDropdown.click()

  // Find and click logout menu item (contains LogOut icon)
  const logoutItem = page.getByRole('menuitem').filter({ has: page.locator('svg.lucide-log-out') })
  await logoutItem.click()

  // Clear auth cookie
  await page.context().clearCookies()
}
