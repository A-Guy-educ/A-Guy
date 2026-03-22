// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Navigate exercise action - move between exercises in a lesson
 * Replaces: nextExercise, previousExercise
 * @fileType action-handler
 * @domain qa
 * @pattern lesson-actions
 * @normalized
 */
import type { ActionHandler } from './types'
import { LABELS } from '../shared/locales'

type Direction = 'next' | 'prev'

export const navigateExercise: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const direction = input?.direction as Direction | undefined

  if (!direction) {
    throw new Error('navigateExercise action requires direction input (next or prev)')
  }

  const labels = LABELS[locale]
  const buttonLabel = direction === 'next' ? labels.next : labels.previous
  const button = page.getByRole('button', { name: buttonLabel })
  await button.click()
  await page.waitForLoadState('networkidle')
}
