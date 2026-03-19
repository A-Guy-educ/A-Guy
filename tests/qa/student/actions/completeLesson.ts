// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Complete lesson action handler
 * @fileType action-handler
 * @domain qa
 * @pattern lesson-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const completeLesson: ActionHandler = async (ctx) => {
  const { page, locale } = ctx
  const labels = LABELS[locale]

  const completeButton = page.getByRole('button', { name: labels.complete })
  await completeButton.click()
  await page.waitForLoadState('networkidle')
}
