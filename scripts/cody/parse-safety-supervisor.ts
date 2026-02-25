/**
 * @fileType utility
 * @domain cody
 * @ai-summary Validate comment trigger safety for supervisor workflow
 */

import { writeFileSync } from 'fs'

interface SafetyResult {
  valid: string
  reason?: string
}

// The bot account that posts failure comments
const BOT_ACCOUNT = 'github-actions[bot]'

// Failure comment pattern
const FAILURE_PATTERN = /^❌ Pipeline failed/

/**
 * Validate supervisor safety - only accepts failure comments from github-actions[bot]
 */
export function validateSupervisorSafety(author: string, comment: string): SafetyResult {
  // Must be github-actions[bot]
  if (author !== BOT_ACCOUNT) {
    return { valid: 'false', reason: 'not_bot' }
  }

  // Must be a failure comment
  if (!FAILURE_PATTERN.test(comment)) {
    return { valid: 'false', reason: 'not_failure_comment' }
  }

  return { valid: 'true' }
}

/**
 * Write outputs to GITHUB_OUTPUT
 */
function writeOutputs(result: SafetyResult): void {
  const githubOutput = process.env.GITHUB_OUTPUT || ''

  if (!githubOutput) {
    console.error('GITHUB_OUTPUT not set!')
    process.exit(1)
  }

  const lines = [`valid=${result.valid}`]
  if (result.reason) {
    lines.push(`reason=${result.reason}`)
  }

  writeFileSync(githubOutput, lines.join('\n') + '\n')
}

/**
 * Main entry point
 */
function main(): void {
  const author = process.env.AUTHOR || ''
  const comment = process.env.COMMENT_BODY || ''

  const result = validateSupervisorSafety(author, comment)
  writeOutputs(result)
}

// Run if called directly
if (require.main === module) {
  main()
}
