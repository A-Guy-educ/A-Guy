// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Start lesson action handler
 * @fileType action-handler
 * @domain qa
 * @pattern lesson-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const startLesson: ActionHandler = async (ctx) => {
  const { page, locale } = ctx
  const labels = LABELS[locale]

  const startButton = page.getByRole('button', { name: labels.startLesson })
  await startButton.click()
  await page.waitForLoadState('networkidle')
}
