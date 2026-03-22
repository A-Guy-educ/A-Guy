// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Submit answer action handler
 * Handles MCQ, True/False, Free Response, and Matching question types
 * @fileType action-handler
 * @domain qa
 * @pattern exercise-actions
 */
import type { ActionContext, ActionHandler, UserAnswer } from './types'
import { LABELS } from '../shared/locales'

export const submitAnswer: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const questionIndex = input?.questionIndex as number | undefined
  const value = input?.value as UserAnswer | undefined

  if (questionIndex === undefined || !value) {
    throw new Error('submitAnswer action requires questionIndex and value inputs')
  }

  const labels = LABELS[locale]

  // Find the question container at the given index
  const questionContainers = page.locator('[class*="question"], [class*="exercise"]')

  if (questionIndex >= (await questionContainers.count())) {
    throw new Error(`Question index ${questionIndex} out of bounds`)
  }

  const questionContainer = questionContainers.nth(questionIndex)

  switch (value.type) {
    case 'mcq': {
      // Click the option labels/buttons matching the selected IDs
      for (const optionId of value.selectedIds) {
        // Try multiple selectors for MCQ options
        const option = questionContainer.locator(`[data-option-id="${optionId}"]`).first()
        if ((await option.count()) > 0) {
          await option.click()
        } else {
          // Fall back to text-based selection
          const optionByText = page.getByText(optionId, { exact: true })
          await optionByText.click()
        }
      }
      break
    }

    case 'true_false': {
      // Click True or False button
      const buttonName = value.value ? 'True' : 'False'
      const tfButton = questionContainer.getByRole('button', { name: new RegExp(buttonName, 'i') })
      await tfButton.click()
      break
    }

    case 'free_response': {
      // Fill the textarea
      const textarea = questionContainer.locator('textarea, input[type="text"]').first()
      await textarea.fill(value.value)
      break
    }

    case 'matching': {
      // Click left item, then right item for each connection
      for (const conn of value.connections) {
        const leftItem = questionContainer.locator(`[data-match-id="${conn.leftId}"]`).first()
        const rightItem = questionContainer.locator(`[data-match-id="${conn.rightId}"]`).first()
        await leftItem.click()
        await rightItem.click()
      }
      break
    }

    default:
      throw new Error(`Unknown answer type: ${(value as { type: string }).type}`)
  }

  // Small wait for UI to update
  await page.waitForTimeout(300)
}
