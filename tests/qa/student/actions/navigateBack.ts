// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Navigate back action handler
 * @fileType action-handler
 * @domain qa
 * @pattern navigation-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const navigateBack: ActionHandler = async (ctx) => {
  const { page, locale } = ctx
  const labels = LABELS[locale]

  // Try back button first
  const backButton = page.getByRole('button', { name: labels.back })
  const backLink = page.getByRole('link', { name: labels.back })

  if ((await backButton.count()) > 0) {
    await backButton.click()
  } else if ((await backLink.count()) > 0) {
    await backLink.click()
  } else {
    // Fall back to browser back
    await page.goBack()
  }

  await page.waitForLoadState('networkidle')
}
