/**
 * @fileType utility
 * @domain ci | cody
 * @pattern clarify-workflow
 * @ai-summary Question/answer workflow for clarification stage - extracted from cody.ts for testability
 */

import * as fs from 'fs'
import * as path from 'path'

import { getLatestIssueComment, type CodyInput } from './cody-utils'
import { checkForQuestions } from './content-validators'

// ============================================================================
// Answer Extraction
// ============================================================================

/**
 * Extract the answer from a GitHub comment body
 * The comment format is: /cody [command] [task-id] [optional answer text]
 */
export function extractAnswerFromComment(commentBody: string): string | null {
  // Decode JSON-encoded body if needed (from jq -Rs .)
  let decoded = commentBody
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    try {
      decoded = JSON.parse(decoded)
    } catch {
      // Use raw value if JSON.parse fails
    }
  }

  // Normalize literal \n to real newlines
  decoded = decoded.replace(/\\n/g, '\n')

  // Remove /cody prefix and command
  const withoutCody = decoded.replace(/^\/cody\s*/, '').trim()

  // If there's content after the command, treat it as the answer
  if (withoutCody.length > 0) {
    // Remove task-id if present (format: /cody [task-id] or /cody full [task-id])
    const taskIdMatch = withoutCody.match(/^([a-z]+\s+)?([0-9]{6}-[a-z0-9-]+\s*)/i)
    let answer = withoutCody
    if (taskIdMatch) {
      answer = withoutCody.slice(taskIdMatch[0].length).trim()
    }

    // If there's answer content, return it
    if (answer.length > 0) {
      return answer
    }
  }

  return null
}

// ============================================================================
// Clarification Handler
// ============================================================================

/**
 * Result of handling clarification
 */
export type ClarifyResult = 'answered' | 'waiting' | 'no-questions'

/**
 * Handle clarification workflow for the spec pipeline.
 * Checks if questions.md exists, extracts answer from comment if provided,
 * and creates clarified.md.
 *
 * @param input - The CodyInput with commentBody and trigger info
 * @param taskDir - Path to the task directory
 * @returns 'answered' if user provided answer, 'waiting' if questions exist, 'no-questions' if no clarification needed
 */
export function handleClarification(input: CodyInput, taskDir: string): ClarifyResult {
  const questionsPath = path.join(taskDir, 'questions.md')

  // If questions.md doesn't exist, no clarification needed
  if (!fs.existsSync(questionsPath)) {
    return 'no-questions'
  }

  let answer: string | null = null

  // Try to get answer from:
  // 1. Comment body (if user wrote "/cody answer text")
  if (input.commentBody && input.triggerType === 'comment') {
    answer = extractAnswerFromComment(input.commentBody)
  }

  // 2. Latest comment on the issue (plain text answer)
  if (!answer && input.issueNumber && input.triggerType === 'comment') {
    // Get the latest comment (not from bot) as the answer
    answer = getLatestIssueComment(input.issueNumber, 'github-actions[bot]')
  }

  // If we have an answer, create clarified.md
  if (answer) {
    const clarifiedPath = path.join(taskDir, 'clarified.md')
    fs.writeFileSync(clarifiedPath, `# Clarified\n\n${answer}\n`)
    return 'answered'
  }

  // Check if there are pending questions
  const clarifiedExists = fs.existsSync(path.join(taskDir, 'clarified.md'))
  const hasQuestions = !clarifiedExists && checkForQuestions(questionsPath)

  if (hasQuestions) {
    return 'waiting'
  }

  // No questions - create default clarified.md
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
  }

  return 'no-questions'
}
