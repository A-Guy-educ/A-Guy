// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Expect feedback action handler
 * Asserts exercise feedback state (correct/incorrect)
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 */
import { expect } from '@playwright/test'
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const expectFeedback: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const questionIndex = input?.questionIndex as number | undefined
  const correct = input?.correct as boolean | undefined

  if (questionIndex === undefined || correct === undefined) {
    throw new Error('expectFeedback action requires questionIndex and correct inputs')
  }

  const _labels = LABELS[locale]
  const expectedText = correct ? labels.correct : labels.incorrect

  // Find the feedback element at questionIndex
  const feedbackElements = page.locator('[class*="feedback"], [class*="result"]')

  if (questionIndex >= (await feedbackElements.count())) {
    throw new Error(`Feedback element at index ${questionIndex} not found`)
  }

  const feedbackElement = feedbackElements.nth(questionIndex)
  await expect(feedbackElement).toContainText(expectedText)
}
