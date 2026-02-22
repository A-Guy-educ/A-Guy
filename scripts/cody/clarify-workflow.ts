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
  const clarifiedPath = path.join(taskDir, 'clarified.md')

  // If questions.md doesn't exist, no clarification needed - create default clarified.md
  if (!fs.existsSync(questionsPath)) {
    if (!fs.existsSync(clarifiedPath)) {
      fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
    }
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
    fs.writeFileSync(clarifiedPath, `# Clarified\n\n${answer}\n`)
    return 'answered'
  }

  // Check if there are pending questions
  const hasQuestions = !fs.existsSync(clarifiedPath) && checkForQuestions(questionsPath)

  if (hasQuestions) {
    return 'waiting'
  }

  // No questions - create default clarified.md
  if (!fs.existsSync(clarifiedPath)) {
    fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
  }

  return 'no-questions'
}

// ============================================================================
// Gate Approval Handler
// ============================================================================

/**
 * Result of handling gate approval
 */
export type GateResult = 'approved' | 'rejected' | 'waiting'

/**
 * Approval keywords that indicate user wants to proceed
 */
const APPROVAL_KEYWORDS = ['approve', 'approved', 'yes', 'go', 'proceed', 'y', 'continue']

/**
 * Rejection keywords that indicate user wants to cancel
 */
const REJECTION_KEYWORDS = ['reject', 'rejected', 'no', 'cancel', 'stop', 'n']

/**
 * Get the gate file paths for a specific gate point
 */
function getGateFiles(
  taskDir: string,
  gatePoint: string,
): { requestPath: string; approvedPath: string } {
  const requestPath = path.join(taskDir, `gate-${gatePoint}.md`)
  const approvedPath = path.join(taskDir, `gate-${gatePoint}-approved.md`)
  return { requestPath, approvedPath }
}

/**
 * Check if a comment contains approval or rejection keywords
 */
function detectApprovalFromComment(commentBody: string | null): 'approved' | 'rejected' | null {
  if (!commentBody) return null

  // Decode if JSON-encoded
  let decoded = commentBody
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    try {
      decoded = JSON.parse(decoded)
    } catch {
      // Use raw value
    }
  }

  // Normalize
  decoded = decoded.toLowerCase().replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()

  // Remove /cody prefix
  decoded = decoded.replace(/^\/cody\s*/, '').trim()

  // Check for rejection keywords first (more specific)
  for (const keyword of REJECTION_KEYWORDS) {
    if (
      decoded === keyword ||
      decoded.startsWith(keyword + ' ') ||
      decoded.startsWith(keyword + '\n')
    ) {
      return 'rejected'
    }
  }

  // Check for approval keywords
  for (const keyword of APPROVAL_KEYWORDS) {
    if (
      decoded === keyword ||
      decoded.startsWith(keyword + ' ') ||
      decoded.startsWith(keyword + '\n')
    ) {
      return 'approved'
    }
  }

  return null
}

/**
 * Format the gate comment for posting to the issue
 */
function formatGateComment(
  controlMode: string,
  riskLevel: string,
  taskType: string,
  confidence: number,
  scope: string[],
  taskSummary: string,
  gatePoint: string,
  planContent?: string,
): string {
  const lines: string[] = []

  if (controlMode === 'hard-stop') {
    lines.push('## 🚫 Hard Stop: Approval Required\n')
    lines.push(
      'This task has been classified as **high risk** and requires mandatory approval before proceeding.\n',
    )
  } else {
    lines.push('## 🚦 Risk Gate: Approval Required\n')
    lines.push(
      'This task has been classified as **medium risk** and is paused for review before building.\n',
    )
  }

  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| **Control Mode** | ${controlMode} |`)
  lines.push(`| **Risk Level** | ${riskLevel} |`)
  lines.push(`| **Task Type** | ${taskType} |`)
  lines.push(`| **Confidence** | ${confidence} |`)
  lines.push(`| **Scope** | ${scope.length} files |`)
  lines.push('')

  lines.push('### Task Summary')
  lines.push(`> ${taskSummary.split('\n')[0]}`)
  lines.push('')

  if (planContent && gatePoint === 'architect') {
    lines.push('### Plan')
    // First 20 lines of plan
    const planLines = planContent.split('\n').slice(0, 20).join('\n')
    lines.push('```')
    lines.push(planLines)
    lines.push('```')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('Reply with `/cody approve` to proceed or `/cody reject` to cancel.')

  return lines.join('\n')
}

/**
 * Handle gate approval workflow for risk-gated and hard-stop modes.
 * Similar to clarification workflow but for approval gates.
 *
 * @param input - The CodyInput with commentBody and trigger info
 * @param taskDir - Path to the task directory
 * @param gatePoint - Which gate: 'taskify' or 'architect'
 * @param taskDef - The task definition (for context in the gate comment)
 * @param planContent - Optional plan content (for architect gate)
 * @returns 'approved' if user approved, 'rejected' if user rejected, 'waiting' if awaiting approval
 */
export function handleGateApproval(
  input: CodyInput,
  taskDir: string,
  gatePoint: string,
  taskDef: { risk_level: string; task_type: string; confidence: number; scope: string[] },
  planContent?: string,
): GateResult {
  const { requestPath, approvedPath } = getGateFiles(taskDir, gatePoint)

  // If already approved, return approved
  if (fs.existsSync(approvedPath)) {
    return 'approved'
  }

  // Check for approval/rejection in the current comment
  const approval = detectApprovalFromComment(input.commentBody || null)

  // Also check latest issue comment if not found in current trigger
  if (!approval && input.issueNumber && input.triggerType === 'comment') {
    const latestComment = getLatestIssueComment(input.issueNumber, 'github-actions[bot]')
    const latestApproval = detectApprovalFromComment(latestComment)
    if (latestApproval) {
      // User replied with approve/reject - write the approved file
      if (latestApproval === 'approved') {
        fs.writeFileSync(approvedPath, `# Gate Approved\n\nApproved at ${gatePoint} gate.\n`)
        return 'approved'
      } else {
        // Write rejection marker
        fs.writeFileSync(requestPath, `# Gate Rejected\n\nRejected at ${gatePoint} gate.\n`)
        return 'rejected'
      }
    }
  }

  // If we have approval in current trigger
  if (approval === 'approved') {
    fs.writeFileSync(approvedPath, `# Gate Approved\n\nApproved at ${gatePoint} gate.\n`)
    return 'approved'
  } else if (approval === 'rejected') {
    fs.writeFileSync(requestPath, `# Gate Rejected\n\nRejected at ${gatePoint} gate.\n`)
    return 'rejected'
  }

  // If request file already exists, we're waiting
  if (fs.existsSync(requestPath)) {
    return 'waiting'
  }

  // First time hitting the gate - create request and return waiting
  // Read task summary from task.md
  const taskMdPath = path.join(taskDir, 'task.md')
  let taskSummary = 'See task.md for details'
  if (fs.existsSync(taskMdPath)) {
    const taskContent = fs.readFileSync(taskMdPath, 'utf-8')
    const firstLines = taskContent.split('\n').slice(0, 3).join(' ')
    taskSummary = firstLines || taskSummary
  }

  const comment = formatGateComment(
    taskDef.risk_level === 'high' ? 'hard-stop' : 'risk-gated',
    taskDef.risk_level,
    taskDef.task_type,
    taskDef.confidence,
    taskDef.scope,
    taskSummary,
    gatePoint,
    planContent,
  )

  // Write gate request file
  fs.writeFileSync(requestPath, `# Gate Request\n\n${comment}\n`)

  // Return waiting - caller will post the comment to the issue
  return 'waiting'
}
