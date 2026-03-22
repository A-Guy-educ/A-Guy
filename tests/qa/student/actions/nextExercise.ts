// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Next exercise action handler
 * @fileType action-handler
 * @domain qa
 * @pattern lesson-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const nextExercise: ActionHandler = async (ctx) => {
  const { page, locale } = ctx
  const labels = LABELS[locale]

  const nextButton = page.getByRole('button', { name: labels.next })
  await nextButton.click()
  await page.waitForLoadState('networkidle')
}
