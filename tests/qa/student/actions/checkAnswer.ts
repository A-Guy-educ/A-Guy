// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Check answer action handler
 * @fileType action-handler
 * @domain qa
 * @pattern exercise-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const checkAnswer: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const questionIndex = input?.questionIndex as number | undefined

  if (questionIndex === undefined) {
    throw new Error('checkAnswer action requires questionIndex input')
  }

  const _labels = LABELS[locale]

  // Find all Check Answer buttons and click the one at questionIndex
  const buttons = page.getByRole('button', { name: labels.checkAnswer })

  const count = await buttons.count()
  if (count === 0) {
    throw new Error('No Check Answer button found')
  }

  if (questionIndex >= count) {
    throw new Error(`Question index ${questionIndex} out of bounds (found ${count} buttons)`)
  }

  await buttons.nth(questionIndex).click()

  // Wait for async check to complete
  await page.waitForTimeout(500)
}
