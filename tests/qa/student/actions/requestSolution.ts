// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Request solution action handler
 * @fileType action-handler
 * @domain qa
 * @pattern exercise-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const requestSolution: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const questionIndex = input?.questionIndex as number | undefined

  if (questionIndex === undefined) {
    throw new Error('requestSolution action requires questionIndex input')
  }

  const _labels = LABELS[locale]

  // Find all Solution buttons and click the one at questionIndex
  const buttons = page.getByRole('button', { name: labels.solution })

  const count = await buttons.count()
  if (count === 0) {
    throw new Error('No Solution button found')
  }

  if (questionIndex >= count) {
    throw new Error(`Question index ${questionIndex} out of bounds`)
  }

  await buttons.nth(questionIndex).click()
  await page.waitForLoadState('networkidle')
}
