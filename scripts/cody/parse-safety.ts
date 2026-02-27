/**
 * @fileType utility
 * @domain cody
 * @ai-summary Validate comment trigger safety filters
 */

import { writeFileSync } from 'fs'

interface SafetyResult {
  valid: string
  reason?: string
}

// Valid author associations
const VALID_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR']

// Known bot accounts (exact match)
const KNOWN_BOTS = ['github-actions[bot]']

/**
 * Check if author is a bot
 */
export function isBot(author: string): boolean {
  // Exact match for known bots
  if (KNOWN_BOTS.includes(author)) return true
  // Pattern: ends with [bot]
  if (author.endsWith('[bot]')) return true
  return false
}

/**
 * Check if author association is valid
 */
export function isValidAssociation(association: string): boolean {
  return VALID_ASSOCIATIONS.includes(association)
}

/**
 * Check if comment contains @cody or /cody command
 */
export function hasCodyCommand(comment: string): boolean {
  // @cody can be anywhere in the comment
  if (comment.includes('@cody')) return true

  // /cody must be on first line
  const firstLine = comment.split('\n')[0]
  if (/^\/cody(\s|$)/.test(firstLine)) return true

  return false
}

/**
 * Validate comment safety
 */
export function validateSafety(author: string, association: string, comment: string): SafetyResult {
  // Check if author is a bot
  if (isBot(author)) {
    return { valid: 'false', reason: 'bot' }
  }

  // Check author association
  if (!isValidAssociation(association)) {
    return { valid: 'false', reason: 'unauthorized' }
  }

  // Check for @cody or /cody pattern
  if (!hasCodyCommand(comment)) {
    return { valid: 'false', reason: 'pattern' }
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
  const association = process.env.ASSOCIATION || ''
  const comment = process.env.COMMENT_BODY || ''

  const result = validateSafety(author, association, comment)
  writeOutputs(result)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
