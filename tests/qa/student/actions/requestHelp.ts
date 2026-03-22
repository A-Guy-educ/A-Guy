// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Request help action - request hint or solution for an exercise
 * Replaces: requestHint, requestSolution
 * @fileType action-handler
 * @domain qa
 * @pattern exercise-actions
 * @normalized
 */
import type { ActionHandler } from './types'
import { LABELS } from '../shared/locales'

type HelpLevel = 'hint' | 'solution'

export const requestHelp: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const level = input?.level as HelpLevel | undefined
  const questionIndex = input?.questionIndex as number | undefined

  if (!level) {
    throw new Error('requestHelp action requires level input (hint or solution)')
  }

  const labels = LABELS[locale]
  const buttonLabel = level === 'hint' ? labels.hint : labels.solution

  // Find all Help/Solution buttons
  const buttons = page.getByRole('button', { name: buttonLabel })

  const count = await buttons.count()
  if (count === 0) {
    throw new Error(`No ${level} button found`)
  }

  // If questionIndex provided, click that specific button; otherwise click first
  if (questionIndex !== undefined) {
    if (questionIndex >= count) {
      throw new Error(`Question index ${questionIndex} out of bounds (found ${count} buttons)`)
    }
    await buttons.nth(questionIndex).click()
  } else {
    await buttons.first().click()
  }

  await page.waitForLoadState('networkidle')
}
