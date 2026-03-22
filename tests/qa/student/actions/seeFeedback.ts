// eslint-disable @typescript-eslint/no-unused-vars
/**
 * SeeFeedback action - asserts exercise feedback state (correct/incorrect)
 * Renamed from: expectFeedback
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 * @normalized
 */
import { expect } from '@playwright/test'
import type { ActionHandler } from './types'
import { LABELS } from '../shared/locales'
import { SELECTORS } from '../shared/selectors'

export const seeFeedback: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const questionIndex = input?.questionIndex as number | undefined
  const correct = input?.correct as boolean | undefined

  if (questionIndex === undefined || correct === undefined) {
    throw new Error('seeFeedback action requires questionIndex and correct inputs')
  }

  const labels = LABELS[locale]
  const expectedText = correct ? labels.correct : labels.incorrect

  // Find the feedback element at questionIndex
  const feedbackElements = page.locator(SELECTORS.exercise.feedbackContainer)

  if (questionIndex >= (await feedbackElements.count())) {
    throw new Error(`Feedback element at index ${questionIndex} not found`)
  }

  const feedbackElement = feedbackElements.nth(questionIndex)
  await expect(feedbackElement).toContainText(expectedText)
}
