/**
 * Exercise Reference Parser
 *
 * Parses student chat messages for explicit exercise references.
 * Supports Hebrew and English patterns.
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern single-responsibility
 */

export interface ExerciseReference {
  exerciseNumber: number
  originalText: string
}

/**
 * Regex patterns that match exercise references in student messages.
 * Each pattern must have a capture group for the exercise number.
 */
const EXERCISE_PATTERNS: RegExp[] = [
  // Hebrew: תרגיל 5, תרגיל5
  /תרגיל\s*(\d+)/g,
  // Hebrew: שאלה 5, שאלה5
  /שאלה\s*(\d+)/g,
  // English: exercise 5, Exercise 5
  /exercise\s+(\d+)/gi,
  // English: question 5, Question 5
  /question\s+(\d+)/gi,
  // Abbreviated: ex. 5, ex 5, Ex.5 (must be at word boundary on both sides)
  /\bex\.?\s*(\d+)\b/gi,
  // Abbreviated: q. 5, q 5, Q.5 (require dot or space after q to avoid false positives)
  /\bq[.\s]\s*(\d+)\b/gi,
]

/**
 * Parse a student message for exercise number references.
 *
 * @param message - The student's chat message
 * @returns Deduplicated list of exercise references found, empty if none
 */
export function parseExerciseReferences(message: string): ExerciseReference[] {
  if (!message?.trim()) return []

  const seen = new Set<number>()
  const results: ExerciseReference[] = []

  for (const pattern of EXERCISE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(message)) !== null) {
      const num = parseInt(match[1], 10)
      if (num > 0 && !seen.has(num)) {
        seen.add(num)
        results.push({
          exerciseNumber: num,
          originalText: match[0],
        })
      }
    }
  }

  return results
}
