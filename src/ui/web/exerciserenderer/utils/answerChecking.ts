/**
 * Answer Checking Utilities
 * Logic for checking user answers against correct answers
 */

import type {
  QuestionBlock,
  QuestionFreeResponseBlock,
  QuestionMatchingBlock,
  QuestionGeometryBlock,
  QuestionAxisBlock,
  QuestionAnswer,
  SvgBlock,
  UserAnswer,
  CheckResult,
} from '../types'

export interface AnswerErrorMessages {
  invalidAnswerType: string
  selectTrueFalse: string
  noCorrectAnswer: string
  selectAnAnswer: string
  enterAnAnswer: string
  unknownVariant: string
  validationFailed: string
  validationError: string
  connectionError: string
}

/**
 * Check if a user's answer is correct for a given question
 */
export async function checkQuestionAnswer(
  question: QuestionBlock,
  answer: UserAnswer,
  messages: AnswerErrorMessages,
): Promise<CheckResult> {
  switch (question.type) {
    case 'question_select': {
      if (question.variant === 'true_false') {
        if (answer.type !== 'true_false') {
          return { isCorrect: false, message: messages.invalidAnswerType }
        }
        if (answer.value === null || answer.value === undefined) {
          return { isCorrect: false, message: messages.selectTrueFalse }
        }
        if (!question.answer.correctOptionId) {
          return { isCorrect: false, message: messages.noCorrectAnswer }
        }
        const userOptionId = answer.value ? 'true' : 'false'
        return {
          isCorrect: userOptionId === question.answer.correctOptionId,
        }
      } else if (question.variant === 'mcq') {
        if (answer.type !== 'mcq') {
          return { isCorrect: false, message: messages.invalidAnswerType }
        }
        if (answer.selectedIds.length === 0) {
          return { isCorrect: false, message: messages.selectAnAnswer }
        }
        const userIds = [...answer.selectedIds].sort()
        const correctIds = [...question.answer.correctOptionIds].sort()
        const isCorrect =
          userIds.length === correctIds.length && userIds.every((id, idx) => id === correctIds[idx])
        return { isCorrect }
      }
      return { isCorrect: false, message: messages.unknownVariant }
    }

    case 'question_free_response': {
      if (answer.type !== 'free_response') {
        return { isCorrect: false, message: messages.invalidAnswerType }
      }
      const userValue = answer.value.trim()
      if (userValue === '') {
        return { isCorrect: false, message: messages.enterAnAnswer }
      }

      return validateFreeResponseOnServer(question, userValue, messages)
    }

    case 'question_table':
      // Table validation is handled client-side in TableQuestion component
      return { isCorrect: false, message: messages.invalidAnswerType }

    case 'question_matching': {
      if (answer.type !== 'matching') {
        return { isCorrect: false, message: messages.invalidAnswerType }
      }
      if (answer.connections.length === 0) {
        return { isCorrect: false, message: messages.selectAnAnswer }
      }
      return validateMatchingAnswer(question as QuestionMatchingBlock, answer.connections)
    }

    case 'question_geometry': {
      const geoQuestion = question as QuestionGeometryBlock
      if (!geoQuestion.answer) {
        return { isCorrect: false, message: messages.noCorrectAnswer }
      }
      return validateGenericAnswer(geoQuestion.answer, answer, 'geometry', messages)
    }

    case 'question_axis': {
      const axisQuestion = question as QuestionAxisBlock
      if (!axisQuestion.answer) {
        return { isCorrect: false, message: messages.noCorrectAnswer }
      }
      return validateGenericAnswer(axisQuestion.answer, answer, 'axis', messages)
    }
  }
}

/**
 * Validate matching answer by comparing user connections to correct pairs
 */
function validateMatchingAnswer(
  question: QuestionMatchingBlock,
  connections: Array<{ leftId: string; rightId: string }>,
): CheckResult {
  const correctPairs = question.correctPairs
  const userPairSet = new Set(connections.map((c) => `${c.leftId}:${c.rightId}`))
  const correctPairSet = new Set(correctPairs.map((p) => `${p.optionId}:${p.matchId}`))

  if (userPairSet.size === correctPairSet.size) {
    let allMatch = true
    for (const pair of userPairSet) {
      if (!correctPairSet.has(pair)) {
        allMatch = false
        break
      }
    }
    if (allMatch) return { isCorrect: true }
  }

  let correctCount = 0
  for (const pair of userPairSet) {
    if (correctPairSet.has(pair)) correctCount++
  }

  return {
    isCorrect: false,
    message: `${correctCount}/${correctPairs.length}`,
  }
}

/**
 * Validate free-response answer via server endpoint (DB normalization + LLM fallback)
 */
async function validateFreeResponseOnServer(
  question: QuestionFreeResponseBlock,
  studentAnswer: string,
  messages: AnswerErrorMessages,
): Promise<CheckResult> {
  try {
    const response = await fetch('/api/exercises/validate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: question.id,
        questionText: question.prompt.value,
        acceptedAnswers: question.answer.acceptedAnswers,
        studentAnswer,
        questionType: question.type,
      }),
    })

    if (!response.ok) {
      return { isCorrect: false, message: messages.validationFailed }
    }

    const result = await response.json()

    if (!result.success) {
      return { isCorrect: false, message: result.error || messages.validationError }
    }

    return { isCorrect: result.data.isCorrect }
  } catch {
    return { isCorrect: false, message: messages.connectionError }
  }
}

/**
 * Validate generic answer for geometry/axis questions
 */
function validateGenericAnswer(
  expected: QuestionAnswer,
  userAnswer: UserAnswer,
  answerType: 'geometry' | 'axis',
  messages: AnswerErrorMessages,
): CheckResult {
  if (userAnswer.type !== answerType) {
    return { isCorrect: false, message: messages.invalidAnswerType }
  }

  switch (expected.kind) {
    case 'numeric': {
      const value = userAnswer.numericValue
      if (value === undefined || isNaN(value))
        return { isCorrect: false, message: messages.enterAnAnswer }
      const tolerance = expected.tolerance ?? 0.01
      return { isCorrect: Math.abs(value - expected.value) <= tolerance }
    }
    case 'mcq': {
      const selected = userAnswer.selectedOptionIds ?? []
      if (selected.length === 0) return { isCorrect: false, message: messages.selectAnAnswer }
      const userSorted = [...selected].sort()
      const correctSorted = [...expected.correctOptionIds].sort()
      return {
        isCorrect:
          userSorted.length === correctSorted.length &&
          userSorted.every((id, i) => id === correctSorted[i]),
      }
    }
    case 'free_response': {
      const text = userAnswer.textValue?.trim()
      if (!text) return { isCorrect: false, message: messages.enterAnAnswer }
      const normalized = text.toLowerCase().replace(/\s+/g, ' ')
      return {
        isCorrect: expected.acceptedAnswers.some(
          (a) => a.toLowerCase().replace(/\s+/g, ' ') === normalized,
        ),
      }
    }
    case 'point': {
      const point = userAnswer.point
      if (!point) return { isCorrect: false, message: messages.enterAnAnswer }
      const tolerance = expected.tolerance ?? 0.01
      return {
        isCorrect:
          Math.abs(point.x - expected.x) <= tolerance &&
          Math.abs(point.y - expected.y) <= tolerance,
      }
    }
    case 'function': {
      const expr = userAnswer.functionExpression?.trim()
      if (!expr) return { isCorrect: false, message: messages.enterAnAnswer }
      const normalized = expr.toLowerCase().replace(/\s+/g, '')
      return {
        isCorrect: expected.acceptedExpressions.some(
          (e) => e.toLowerCase().replace(/\s+/g, '') === normalized,
        ),
      }
    }
  }
}

/**
 * Check SVG hotspot answer (standalone — not part of QuestionBlock flow)
 */
export function checkSvgAnswer(
  block: SvgBlock,
  selectedHotspotIds: string[],
  messages: AnswerErrorMessages,
): CheckResult {
  if (!block.correctHotspotIds || block.correctHotspotIds.length === 0) {
    return { isCorrect: false, message: messages.noCorrectAnswer }
  }
  if (selectedHotspotIds.length === 0) {
    return { isCorrect: false, message: messages.selectAnAnswer }
  }

  const correctSet = new Set(block.correctHotspotIds)
  const userSet = new Set(selectedHotspotIds)

  if (correctSet.size !== userSet.size) return { isCorrect: false }
  for (const id of userSet) {
    if (!correctSet.has(id)) return { isCorrect: false }
  }
  return { isCorrect: true }
}

/**
 * Get initial SVG answer state
 */
export function getInitialSvgAnswer(): UserAnswer {
  return { type: 'svg', selectedHotspotIds: [] }
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
    case 'question_table':
      return { type: 'table', cellValues: {} }
    case 'question_matching':
      return { type: 'matching', connections: [] }
    case 'question_geometry':
      return {
        type: 'geometry',
        kind: (question as QuestionGeometryBlock).answer?.kind ?? 'numeric',
      }
    case 'question_axis':
      return { type: 'axis', kind: (question as QuestionAxisBlock).answer?.kind ?? 'numeric' }
  }
}
