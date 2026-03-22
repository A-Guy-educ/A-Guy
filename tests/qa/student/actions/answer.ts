// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Answer action - submits an answer to an exercise question
 * Renamed from: submitAnswer
 * @fileType action-handler
 * @domain qa
 * @pattern exercise-actions
 * @normalized
 */
import type { ActionHandler, UserAnswer } from './types'
import { LABELS } from '../shared/locales'
import { SELECTORS } from '../shared/selectors'

export const answer: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const questionIndex = input?.questionIndex as number | undefined
  const value = input?.value as UserAnswer | undefined

  if (questionIndex === undefined || !value) {
    throw new Error('answer action requires questionIndex and value inputs')
  }

  // Find the question container at the given index
  const questionContainers = page.locator(SELECTORS.exercise.questionContainer)

  if (questionIndex >= (await questionContainers.count())) {
    throw new Error(`Question index ${questionIndex} out of bounds`)
  }

  const questionContainer = questionContainers.nth(questionIndex)

  switch (value.type) {
    case 'mcq': {
      // Click the option labels/buttons matching the selected IDs
      for (const optionId of value.selectedIds) {
        const option = questionContainer.locator(SELECTORS.exercise.mcqOption(optionId)).first()
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
      const labels = LABELS[locale]
      const buttonName = value.value ? labels.correct : labels.incorrect
      const tfButton = questionContainer.getByRole('button', { name: new RegExp(buttonName, 'i') })
      await tfButton.click()
      break
    }

    case 'free_response': {
      // Fill the textarea
      const textarea = questionContainer.locator(SELECTORS.exercise.textInput).first()
      await textarea.fill(value.value)
      break
    }

    case 'matching': {
      // Click left item, then right item for each connection
      for (const conn of value.connections) {
        const leftItem = questionContainer
          .locator(SELECTORS.exercise.matchItem(conn.leftId))
          .first()
        const rightItem = questionContainer
          .locator(SELECTORS.exercise.matchItem(conn.rightId))
          .first()
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
