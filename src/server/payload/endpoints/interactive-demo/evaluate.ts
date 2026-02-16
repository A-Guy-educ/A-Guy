/**
 * Correctness Evaluator for Interactive Demo
 *
 * FIX #1: MCQ single-select only
 * FIX #8: Open answer returns boolean only, no 'ambiguous' state
 * FIX #13: Deterministic UX feedback messages
 */

// Demo v1: single-select MCQ only
export function evaluateMcq(selectedOptionId: string, correctOptionId: string): boolean {
  return selectedOptionId === correctOptionId
}

// Demo v1: deterministic string matching only, no LLM validation (FIX #8)
export function evaluateOpen(answer: string, acceptedAnswers: string[]): boolean {
  const trimmed = answer.trim().toLowerCase()
  // Pass 1: normalized compare
  if (acceptedAnswers.some((a) => a.trim().toLowerCase() === trimmed)) return true
  // Pass 2: whitespace-removed compare
  const noSpace = trimmed.replace(/\s/g, '')
  if (acceptedAnswers.some((a) => a.trim().toLowerCase().replace(/\s/g, '') === noSpace))
    return true
  // No match → incorrect (remediation will still trigger if enabled)
  return false
}

// FIX #13: Deterministic feedback message for open answer evaluation
const DEFAULT_OPEN_INCORRECT_FEEDBACK = 'Not quite. Check your formatting and try again.'

export function getOpenFeedback(isCorrect: boolean, answerFormatHint?: string): string {
  if (isCorrect) return 'Correct!'
  return answerFormatHint ?? DEFAULT_OPEN_INCORRECT_FEEDBACK
}

export function getMcqFeedback(isCorrect: boolean): string {
  return isCorrect ? 'Correct!' : 'Not quite right.'
}
