// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Previous exercise action handler
 * @fileType action-handler
 * @domain qa
 * @pattern lesson-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const previousExercise: ActionHandler = async (ctx) => {
  const { page, locale } = ctx
  const labels = LABELS[locale]

  const prevButton = page.getByRole('button', { name: labels.previous })
  await prevButton.click()
  await page.waitForLoadState('networkidle')
}
