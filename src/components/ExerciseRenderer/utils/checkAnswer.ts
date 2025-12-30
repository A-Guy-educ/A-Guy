/**
 * Answer Checking Logic
 * Validates user answers against answer specifications
 */

import type { AnswerSpec } from '@/contracts'
import type { UserAnswer, CheckResult } from '../types'

/**
 * Check if a user's answer is correct
 * v0: Basic comparison logic, no CAS for algebraic equivalence
 */
export function checkAnswer(spec: AnswerSpec, answer: UserAnswer): CheckResult {
  // Type mismatch check
  if (spec.questionType !== answer.type) {
    return {
      isCorrect: false,
      message: 'Invalid answer type',
    }
  }

  switch (spec.questionType) {
    case 'mcq':
      return checkMcqAnswer(spec, answer as Extract<UserAnswer, { type: 'mcq' }>)
    case 'true_false':
      return checkTrueFalseAnswer(spec, answer as Extract<UserAnswer, { type: 'true_false' }>)
    case 'free_response':
      return checkFreeResponseAnswer(spec, answer as Extract<UserAnswer, { type: 'free_response' }>)
    default:
      return {
        isCorrect: false,
        message: 'Unknown question type',
      }
  }
}

function checkMcqAnswer(
  spec: Extract<AnswerSpec, { questionType: 'mcq' }>,
  answer: Extract<UserAnswer, { type: 'mcq' }>,
): CheckResult {
  if (answer.selectedIds.length === 0) {
    return {
      isCorrect: false,
      message: 'Please select an answer',
    }
  }

  // Sort both arrays for comparison
  const userIds = [...answer.selectedIds].sort()
  const correctIds = [...spec.correctOptionIds].sort()

  const isCorrect =
    userIds.length === correctIds.length && userIds.every((id, idx) => id === correctIds[idx])

  return {
    isCorrect,
  }
}

function checkTrueFalseAnswer(
  spec: Extract<AnswerSpec, { questionType: 'true_false' }>,
  answer: Extract<UserAnswer, { type: 'true_false' }>,
): CheckResult {
  if (answer.value === null) {
    return {
      isCorrect: false,
      message: 'Please select True or False',
    }
  }

  return {
    isCorrect: answer.value === spec.correct,
  }
}

function checkFreeResponseAnswer(
  spec: Extract<AnswerSpec, { questionType: 'free_response' }>,
  answer: Extract<UserAnswer, { type: 'free_response' }>,
): CheckResult {
  const userValue = answer.value.trim()

  if (userValue === '') {
    return {
      isCorrect: false,
      message: 'Please enter an answer',
    }
  }

  switch (spec.responseKind) {
    case 'numeric':
      return checkNumericAnswer(spec, userValue)
    case 'algebraic':
      return checkAlgebraicAnswer(spec, userValue)
    case 'text':
      return checkTextAnswer(spec, userValue)
    default:
      return {
        isCorrect: false,
        message: 'Unknown response kind',
      }
  }
}

function checkNumericAnswer(
  spec: Extract<AnswerSpec, { questionType: 'free_response'; responseKind: 'numeric' }>,
  userValue: string,
): CheckResult {
  const userNum = parseFloat(userValue)

  if (isNaN(userNum)) {
    return {
      isCorrect: false,
      message: 'Please enter a valid number',
    }
  }

  const tolerance = spec.tolerance ?? 0

  for (const acceptedAnswer of spec.acceptedAnswers) {
    const correctNum = parseFloat(acceptedAnswer)
    if (isNaN(correctNum)) continue

    if (Math.abs(userNum - correctNum) <= tolerance) {
      return { isCorrect: true }
    }
  }

  return { isCorrect: false }
}

function checkAlgebraicAnswer(
  spec: Extract<AnswerSpec, { questionType: 'free_response'; responseKind: 'algebraic' }>,
  userValue: string,
): CheckResult {
  // v0: Simple string matching with whitespace normalization
  // Future: Implement CAS for algebraic equivalence
  const normalized = userValue.replace(/\s+/g, '')

  for (const acceptedAnswer of spec.acceptedAnswers) {
    const normalizedAccepted = acceptedAnswer.replace(/\s+/g, '')
    if (normalized === normalizedAccepted) {
      return { isCorrect: true }
    }
  }

  return { isCorrect: false }
}

function checkTextAnswer(
  spec: Extract<AnswerSpec, { questionType: 'free_response'; responseKind: 'text' }>,
  userValue: string,
): CheckResult {
  let processedUser = userValue
  const caseSensitive = spec.caseSensitive ?? false
  const normalizeWhitespace = spec.normalizeWhitespace ?? true

  // Normalize whitespace
  if (normalizeWhitespace) {
    processedUser = processedUser.replace(/\s+/g, ' ').trim()
  }

  // Handle case sensitivity
  if (!caseSensitive) {
    processedUser = processedUser.toLowerCase()
  }

  for (const acceptedAnswer of spec.acceptedAnswers) {
    let processedAccepted = acceptedAnswer

    if (normalizeWhitespace) {
      processedAccepted = processedAccepted.replace(/\s+/g, ' ').trim()
    }

    if (!caseSensitive) {
      processedAccepted = processedAccepted.toLowerCase()
    }

    if (processedUser === processedAccepted) {
      return { isCorrect: true }
    }
  }

  return { isCorrect: false }
}
