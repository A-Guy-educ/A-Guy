/**
 * @fileType plugin
 * @domain inspector
 * @pattern failure-analysis-plugin
 * @ai-summary Intelligent failure analysis for Cody pipelines — classifies, analyzes via LLM, and retries
 *
 * Consolidates supervisor's failure-analyzer + retry-classifier + stage-router into
 * a single inspector plugin. Activated when health-check detects a failed task.
 */

import type {
  InspectorPlugin,
  ActionRequest,
  InspectorContext,
  EvaluatedTask,
} from '../../../core/types'
import { readTaskFile } from '../../../clients/github'
import { classifyRetryability } from './classifier'
import { analyzeFailure } from './analyzer'
import { resolveFromStage } from './stage-router'

const MAX_RETRIES = 3

// Retry outcome tracking interfaces
interface RetryAttempt {
  taskId: string
  fromStage: string
  attempt: number
  triggeredAt: string
}

interface StageRetryStats {
  attempts: number
  successes: number
}

// Threshold below which we automatically escalate the from_stage
const SUCCESS_RATE_ESCALATION_THRESHOLD = 0.2 // 20%

/**
 * Count retries by scanning issue comments for [inspector-retry:] tags.
 * Uses the same pattern as the old supervisor's [supervisor-retry:] tags.
 */
function countRetries(ctx: InspectorContext, issueNumber: number, taskId: string): number {
  const comments = ctx.github.getIssueComments(issueNumber)
  let count = 0

  for (const comment of comments) {
    const hasRetryTag = comment.body.includes('[inspector-retry:')
    const hasTaskId = comment.body.includes(`\`${taskId}\``)

    if (hasRetryTag && hasTaskId) {
      const match = comment.body.match(/\[inspector-retry:\s*(\d+)\/\d+\]/)
      if (match) {
        count = Math.max(count, parseInt(match[1], 10))
      }
    }
  }

  return count
}

/**
 * Format the retry tag for dedup / tracking in comments.
 */
function formatRetryTag(attempt: number, max: number = MAX_RETRIES): string {
  return `[inspector-retry: ${attempt}/${max}]`
}

/**
 * Store a retry attempt in state for outcome tracking.
 */
function storeRetryAttempt(
  ctx: InspectorContext,
  taskId: string,
  fromStage: string,
  attempt: number,
): void {
  const key = `cody:retry-attempts`
  const attempts = ctx.state.get<RetryAttempt[]>(key) || []

  attempts.push({
    taskId,
    fromStage,
    attempt,
    triggeredAt: new Date().toISOString(),
  })

  // Keep only last 100 attempts
  const trimmed = attempts.slice(-100)
  ctx.state.set(key, trimmed)
}

/**
 * Get retry history for a specific task.
 */
function getRetryHistory(ctx: InspectorContext, taskId: string): RetryAttempt[] {
  const key = `cody:retry-attempts`
  const attempts = ctx.state.get<RetryAttempt[]>(key) || []
  return attempts.filter((a) => a.taskId === taskId)
}

/**
 * Get per-stage retry success rates.
 */
function getStageRetryStats(ctx: InspectorContext): Map<string, StageRetryStats> {
  const key = `cody:retry-attempts`
  const attempts = ctx.state.get<RetryAttempt[]>(key) || []
  const stats = new Map<string, StageRetryStats>()

  for (const attempt of attempts) {
    const existing = stats.get(attempt.fromStage) || { attempts: 0, successes: 0 }
    existing.attempts++
    // successes will be updated when we check outcomes
    stats.set(attempt.fromStage, existing)
  }

  return stats
}

/**
 * Determine if we should escalate from_stage based on retry history.
 * If the same from_stage has failed before for this task, back up one stage.
 */
function shouldEscalateFromStage(
  ctx: InspectorContext,
  taskId: string,
  failedStage: string,
  proposedFromStage: string,
): string {
  const history = getRetryHistory(ctx, taskId)

  // If we've already retried from this stage for this task, escalate
  const retriedFromSameStage = history.some((h) => h.fromStage === proposedFromStage)
  if (retriedFromSameStage) {
    // Simple escalation: go back one stage in the pipeline
    const pipelineOrder = ['architect', 'plan-gap', 'build', 'test', 'verify', 'commit', 'pr']
    const currentIdx = pipelineOrder.indexOf(proposedFromStage)
    if (currentIdx > 0) {
      const escalated = pipelineOrder[currentIdx - 1]
      ctx.log.info(
        { taskId, fromStage: proposedFromStage, escalatedTo: escalated },
        'Escalating from_stage based on retry history',
      )
      return escalated
    }
  }

  // Check per-stage success rate - if too low, escalate
  const stats = getStageRetryStats(ctx)
  const stageStats = stats.get(proposedFromStage)
  if (stageStats && stageStats.attempts >= 3) {
    const successRate = stageStats.successes / stageStats.attempts
    if (successRate < SUCCESS_RATE_ESCALATION_THRESHOLD) {
      ctx.log.info(
        { taskId, fromStage: proposedFromStage, successRate },
        'Escalating from_stage due to low success rate',
      )
      // Escalate based on failed stage
      if (proposedFromStage === 'build') return 'architect'
      if (proposedFromStage === 'verify') return 'build'
    }
  }

  return proposedFromStage
}

/**
 * Create an intelligent retry action for a failed task.
 *
 * Flow:
 * 1. Check retry count (max 3)
 * 2. Pre-classify retryability (deterministic, no LLM)
 * 3. If unknown → call MiniMax LLM for deep analysis
 * 4. Resolve from_stage
 * 5. Trigger workflow rerun with refined feedback
 */
function createFailureAnalysisAction(
  task: EvaluatedTask,
  _ctx: InspectorContext,
): ActionRequest | null {
  if (task.health !== 'failed') {
    return null
  }

  const dedupKey = `failure-analysis:${task.taskId}`

  return {
    plugin: 'cody-failure-analysis',
    type: 'analyze-and-retry',
    target: task.taskId,
    urgency: 'critical',
    title: `Analyze failure: ${task.taskId}`,
    detail: `Pipeline failed at ${task.failedStage}. Running intelligent analysis.`,
    dedupKey,
    dedupWindowMinutes: 30,
    execute: async (execCtx: InspectorContext) => {
      const { taskId, issueNumber, failedStage, failedError } = task

      // 1. Check retry count
      const retryCount = countRetries(execCtx, issueNumber, taskId)
      execCtx.log.info({ taskId, retryCount }, 'Checking retry count')

      if (retryCount >= MAX_RETRIES) {
        execCtx.log.info({ taskId, retryCount }, 'Max retries exhausted')
        execCtx.github.postComment(
          issueNumber,
          `${formatRetryTag(retryCount)}

## Inspector: Max Retries Exhausted

Inspector exhausted **${retryCount}/${MAX_RETRIES}** retry attempts for \`${taskId}\`.

Manual intervention required. Review the failure history above and either:
- Fix the issue manually and close
- Refine the issue description and run \`/cody rerun ${taskId} --feedback "..."\``,
        )
        // Add needs-manual label to mark this as requiring human attention
        execCtx.github.addLabel(issueNumber, 'cody:needs-manual')
        return { success: true, message: 'Max retries exhausted — posted notice' }
      }

      const currentAttempt = retryCount + 1

      // 2. Pre-classify retryability
      const classification = classifyRetryability(failedStage || 'unknown', failedError || '')
      execCtx.log.info({ taskId, classification }, 'Pre-classification result')

      if (!classification.canRetry) {
        execCtx.github.postComment(
          issueNumber,
          `${formatRetryTag(currentAttempt)}

## Non-Retryable Failure

Pipeline failed at \`${failedStage}\` with a non-retryable error.

**Category:** ${classification.category}
**Reason:** ${classification.reason}

Manual intervention required.`,
        )
        // Add needs-manual label for non-retryable failures
        execCtx.github.addLabel(issueNumber, 'cody:needs-manual')
        return { success: true, message: `Non-retryable: ${classification.reason}` }
      }

      // 3. If format-only, skip LLM and just retry
      if (classification.category === 'format-only') {
        let fromStage = resolveFromStage(failedStage || 'build')
        fromStage = shouldEscalateFromStage(execCtx, taskId, failedStage || 'unknown', fromStage)

        execCtx.github.postComment(
          issueNumber,
          `${formatRetryTag(currentAttempt)}

## Auto-Retry (Format Fix)

Format-only failure detected at \`${failedStage}\`. Auto-retrying from \`${fromStage}\`.`,
        )

        // Store retry attempt
        storeRetryAttempt(execCtx, taskId, fromStage, currentAttempt)

        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: taskId,
          mode: 'rerun',
          from_stage: fromStage,
          feedback: 'Format-only failure — run lint:fix and format:fix before verify.',
        })
        return { success: true, message: 'Format-only retry triggered' }
      }

      // 4. Call LLM for deep analysis
      const requirement = execCtx.github.getIssue(issueNumber).body || 'No issue body available'
      const stageOutput = readTaskFile(taskId, `${failedStage}.md`)
      const verifyOutput = readTaskFile(taskId, 'verify.md')
      const previousFeedback = readTaskFile(taskId, 'rerun-feedback.md')

      execCtx.log.info({ taskId, failedStage }, 'Calling LLM for failure analysis')

      const analysis = await analyzeFailure({
        requirement,
        errorMessage: failedError || 'Unknown error',
        failedStage: failedStage || 'unknown',
        stageOutput,
        verifyOutput: verifyOutput || undefined,
        previousFeedback: previousFeedback || undefined,
        retryNumber: currentAttempt,
      })

      execCtx.log.info({ taskId, rootCause: analysis.rootCause }, 'LLM analysis complete')

      // 5. Route and trigger - check if we should escalate based on history
      let fromStage = resolveFromStage(failedStage || 'build')
      fromStage = shouldEscalateFromStage(execCtx, taskId, failedStage || 'unknown', fromStage)

      execCtx.github.postComment(
        issueNumber,
        `${formatRetryTag(currentAttempt)}

## Failure Analysis

**Failed stage:** \`${failedStage}\`
**Error:** ${failedError}

### Root Cause
${analysis.rootCause}

### Refined Approach
${analysis.refinedFeedback}

---

${analysis.canRetry ? `ℹ️ Auto-triggering rerun from \`${fromStage}\` with refined feedback...` : '> ℹ️ No retry possible — manual intervention required.'}`,
      )

      if (analysis.canRetry && analysis.refinedFeedback) {
        // Store retry attempt for outcome tracking
        storeRetryAttempt(execCtx, taskId, fromStage, currentAttempt)

        execCtx.github.triggerWorkflow('cody.yml', {
          task_id: taskId,
          mode: 'rerun',
          from_stage: fromStage,
          feedback: analysis.refinedFeedback,
        })
        return { success: true, message: `Retry triggered from ${fromStage}` }
      }

      return { success: true, message: 'Analysis posted, no retry possible' }
    },
  }
}

/**
 * Failure analysis plugin.
 *
 * This plugin does NOT discover tasks itself — it relies on health-check's
 * evaluated tasks being passed via the shared state store.
 */
export const failureAnalysisPlugin: InspectorPlugin = {
  name: 'cody-failure-analysis',
  description: 'Intelligent failure analysis and retry for Cody pipelines',
  domain: 'cody',

  async run(ctx) {
    ctx.log.debug('Running failure-analysis plugin')

    // Read evaluated tasks from state (set by health-check plugin)
    const evaluatedTasks = ctx.state.get<EvaluatedTask[]>('cody:evaluatedTasks') || []

    // Filter to failed tasks, excluding those already marked as needing manual intervention
    const failedTasks = evaluatedTasks.filter((t) => {
      if (t.health !== 'failed') return false
      // Skip tasks that already have needs-manual label
      if (t.labels?.includes('cody:needs-manual')) {
        ctx.log.debug({ taskId: t.taskId }, 'Skipping - already marked as needs-manual')
        return false
      }
      return true
    })

    ctx.log.debug({ failedCount: failedTasks.length }, 'Found failed tasks')

    const actions: ActionRequest[] = []

    for (const task of failedTasks) {
      const action = createFailureAnalysisAction(task, ctx)
      if (action) actions.push(action)
    }

    ctx.log.debug({ actionCount: actions.length }, 'Generated failure-analysis actions')

    return actions
  },
}
