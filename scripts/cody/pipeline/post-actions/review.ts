/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Analyzes review.md findings to determine if fix stage is needed
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import type { PipelineContext, PipelineStateV2 } from '../../engine/types'
import { updateStage, writeState } from '../../engine/status'

export async function executeAnalyzeReviewFindings(
  ctx: PipelineContext,
  state: PipelineStateV2 | null,
): Promise<void> {
  const reviewPath = path.join(ctx.taskDir, 'review.md')

  let fixNeeded = false
  const reviewSummary = { critical: 0, major: 0, minor: 0 }

  if (fs.existsSync(reviewPath)) {
    const reviewContent = fs.readFileSync(reviewPath, 'utf-8')
    const contentLower = reviewContent.toLowerCase()

    // Parse review findings with multiple robust patterns
    // Pattern 1: "Critical: N" or "Critical Issues: N" or "**Critical**: N"
    const criticalPatterns = [/critical[^:]*:\s*(\d+)/i, /(\d+)[ \t]+critical/i]
    // Pattern 2: "Major: N" or "Major Issues: N" or "**Major**: N"
    const majorPatterns = [/major[^:]*:\s*(\d+)/i, /(\d+)[ \t]+major/i]
    // Pattern 3: "Minor: N"
    const minorPatterns = [/minor[^:]*:\s*(\d+)/i, /(\d+)[ \t]+minor/i]

    for (const pat of criticalPatterns) {
      const match = reviewContent.match(pat)
      if (match) {
        reviewSummary.critical = Math.max(reviewSummary.critical, parseInt(match[1]))
      }
    }
    for (const pat of majorPatterns) {
      const match = reviewContent.match(pat)
      if (match) {
        reviewSummary.major = Math.max(reviewSummary.major, parseInt(match[1]))
      }
    }
    for (const pat of minorPatterns) {
      const match = reviewContent.match(pat)
      if (match) {
        reviewSummary.minor = Math.max(reviewSummary.minor, parseInt(match[1]))
      }
    }

    // Check for explicit fix-required indicators
    const fixRequiredMatch =
      reviewContent.match(/fix\s*required[^\n]*\[\s*x\s*\]/i) ||
      reviewContent.match(/\[\s*x\s*\][^\n]*fix\s*required/i) ||
      reviewContent.match(/fix\s*required[^\n]*yes/i)

    // Also check for issue-indicating keywords as fallback
    const hasIssueKeywords =
      contentLower.includes('must fix') ||
      contentLower.includes('needs fix') ||
      contentLower.includes('should fix') ||
      contentLower.includes('bug found') ||
      contentLower.includes('security issue') ||
      contentLower.includes('vulnerability')

    fixNeeded =
      reviewSummary.critical > 0 ||
      reviewSummary.major > 0 ||
      fixRequiredMatch !== null ||
      hasIssueKeywords
  }

  // In fix mode, always set fixNeeded to true — user explicitly asked for fixes
  if (ctx.input.mode === 'fix') {
    fixNeeded = true
  }

  // Update state to track findings
  if (state) {
    const updatedState = updateStage(state, 'review', {
      issuesFound: fixNeeded,
      reviewSummary,
    })
    writeState(ctx.taskId, updatedState)
  }

  logger.info(
    `  Review findings: ${reviewSummary.critical} critical, ${reviewSummary.major} major, fixNeeded=${fixNeeded}`,
  )
}
