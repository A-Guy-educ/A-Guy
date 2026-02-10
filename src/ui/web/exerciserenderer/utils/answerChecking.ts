/**
 * Answer Checking Utilities
 * Logic for checking user answers against correct answers
 */

import type { QuestionBlock, UserAnswer, CheckResult } from '../types'

/**
 * Check if a user's answer is correct for a given question
 * Returns a Promise to support future async validation (e.g. AI/Gemini)
 */
export async function checkQuestionAnswer(
  question: QuestionBlock,
  answer: UserAnswer,
): Promise<CheckResult> {
  switch (question.type) {
    case 'question_select': {
      // Check variant to determine answer type
      if (question.variant === 'true_false') {
        if (answer.type !== 'true_false') {
          return { isCorrect: false, message: 'Invalid answer type' }
        }
        if (answer.value === null || answer.value === undefined) {
          return { isCorrect: false, message: 'Please select True or False' }
        }
        if (!question.answer.correctOptionId) {
          return { isCorrect: false, message: 'No correct answer defined' }
        }
        // Convert user's boolean answer to option id and compare
        const userOptionId = answer.value ? 'true' : 'false'
        return {
          isCorrect: userOptionId === question.answer.correctOptionId,
        }
      } else if (question.variant === 'mcq') {
        if (answer.type !== 'mcq') {
          return { isCorrect: false, message: 'Invalid answer type' }
        }
        if (answer.selectedIds.length === 0) {
          return { isCorrect: false, message: 'Please select an answer' }
        }
        const userIds = [...answer.selectedIds].sort()
        const correctIds = [...question.answer.correctOptionIds].sort()
        const isCorrect =
          userIds.length === correctIds.length && userIds.every((id, idx) => id === correctIds[idx])
        return { isCorrect }
      }
      return { isCorrect: false, message: 'Unknown question variant' }
    }

    case 'question_free_response': {
      if (answer.type !== 'free_response') {
        return { isCorrect: false, message: 'Invalid answer type' }
      }
      const userValue = answer.value.trim()
      if (userValue === '') {
        return { isCorrect: false, message: 'Please enter an answer' }
      }

      const { acceptedAnswers } = question.answer

      // Case-insensitive matching for all answers
      const normalized = userValue.toLowerCase().trim()
      for (const accepted of acceptedAnswers) {
        if (normalized === accepted.toLowerCase().trim()) {
          return { isCorrect: true }
        }
      }
      return { isCorrect: false }
    }
  }
}

/**
 * Get initial answer state for a question
 */
export function getInitialAnswer(question: QuestionBlock): UserAnswer {
  switch (question.type) {
    case 'question_select':
      if (question.variant === 'true_false') {
        return { type: 'true_false', value: null }
      } else if (question.variant === 'mcq') {
        return { type: 'mcq', selectedIds: [] }
      }
      return { type: 'true_false', value: null } // fallback
    case 'question_free_response':
      return { type: 'free_response', value: '' }
  }
}
