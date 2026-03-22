/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-actions
 * @ai-summary Post-stage action dispatcher — routes to focused modules.
 *   Small/simple actions remain inlined here; larger actions are in separate files.
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import type { PipelineContext, PostAction, PipelineStateV2 } from '../../engine/types'
import { PipelinePausedError, isBlockingPostAction } from '../../engine/types'

// Focused modules
import { executeValidateTaskJson } from './validate-task-json'
import { executeSetClassificationLabels } from './classification'
import { executeResolveProfile } from './resolve-profile'
import { executeCheckGate } from './gate'
import { executeCommitTaskFiles } from './commit'
import {
  executeRunTsc,
  executeRunUnitTests,
  executeRunQualityWithAutofix,
  executeRunMechanicalAutofix,
} from './quality'
import { executeAnalyzeReviewFindings } from './review'
import {
  executeValidatePlanExists,
  executeValidateBuildContent,
  executeValidateSrcChanges,
} from './validators'
import { executeUpdateKnowledgeBase } from './knowledge-base'

/**
 * Execute a post-action by dispatching to the appropriate module
 */
export async function executePostAction(
  ctx: PipelineContext,
  action: PostAction,
  _state: PipelineStateV2 | null,
): Promise<void> {
  switch (action.type) {
    case 'validate-task-json':
      return executeValidateTaskJson(ctx)

    case 'set-classification-labels':
      return executeSetClassificationLabels(ctx)

    case 'resolve-profile':
      return executeResolveProfile(ctx)

    case 'check-gate':
      return executeCheckGate(ctx, action as PostAction & { type: 'check-gate' }, _state)

    case 'commit-task-files':
      return executeCommitTaskFiles(ctx, action as PostAction & { type: 'commit-task-files' })

    case 'validate-plan-exists':
      return executeValidatePlanExists(ctx)

    case 'validate-build-content':
      return executeValidateBuildContent(ctx)

    case 'validate-src-changes':
      return executeValidateSrcChanges(ctx)

    case 'run-tsc':
      return executeRunTsc(ctx)

    case 'run-unit-tests':
      return executeRunUnitTests(ctx)

    case 'run-quality-with-autofix':
      return executeRunQualityWithAutofix(
        ctx,
        action as PostAction & { type: 'run-quality-with-autofix' },
        _state,
      )

    case 'run-mechanical-autofix':
      return executeRunMechanicalAutofix(ctx)

    case 'analyze-review-findings':
      return executeAnalyzeReviewFindings(ctx, _state)

    // Small actions inlined — not worth separate files
    case 'archive-rerun-feedback': {
      const rerunFeedbackPath = path.join(ctx.taskDir, 'rerun-feedback.md')
      if (fs.existsSync(rerunFeedbackPath)) {
        const consumed = path.join(ctx.taskDir, 'rerun-feedback.consumed.md')
        fs.renameSync(rerunFeedbackPath, consumed)
        logger.info('   Consumed rerun-feedback.md')
      }
      break
    }

    case 'clear-verify-failures': {
      const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
      if (fs.existsSync(verifyFailuresPath)) {
        fs.unlinkSync(verifyFailuresPath)
        logger.info('  Cleared verify-failures.md')
      }
      break
    }

    case 'update-knowledge-base':
      return executeUpdateKnowledgeBase(ctx, _state)

    case 'parallel': {
      if (!('actions' in action) || !Array.isArray((action as { actions?: unknown }).actions)) {
        throw new Error(`'parallel' post-action missing required 'actions' array`)
      }
      const parallelActions = (action as { actions: PostAction[] }).actions
      logger.info(`   Running ${parallelActions.length} actions in parallel...`)

      // Timeout wrapper to prevent hanging on slow post-actions
      const PARALLEL_POST_ACTION_TIMEOUT_MS = 60_000 // 60 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Parallel post-actions exceeded ${PARALLEL_POST_ACTION_TIMEOUT_MS / 1000}s timeout`,
              ),
            ),
          PARALLEL_POST_ACTION_TIMEOUT_MS,
        )
      })

      const results = await Promise.race([
        Promise.allSettled(
          parallelActions.map(async (a) => {
            await executePostAction(ctx, a, _state)
          }),
        ),
        timeoutPromise,
      ])

      // Check for PipelinePausedError first — re-throw it directly to preserve the type
      const pauseResult = results.find(
        (r): r is PromiseRejectedResult =>
          r.status === 'rejected' && r.reason instanceof PipelinePausedError,
      )
      if (pauseResult) {
        throw pauseResult.reason
      }

      // Classify failures into blocking vs advisory
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        // Check if any blocking actions failed
        const blockingFailures: { action: PostAction; error: string }[] = []
        const advisoryFailures: { action: PostAction; error: string }[] = []

        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          if (result.status === 'rejected') {
            const action = parallelActions[i]
            const err =
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            if (isBlockingPostAction(action)) {
              blockingFailures.push({ action, error: err })
            } else {
              advisoryFailures.push({ action, error: err })
            }
          }
        }

        // Log advisory failures as warnings (don't fail the pipeline)
        for (const { action, error } of advisoryFailures) {
          logger.warn({ actionType: action.type }, `   Advisory post-action failed: ${error}`)
        }

        // Throw only if blocking actions failed
        if (blockingFailures.length > 0) {
          const errors = blockingFailures.map((f) => f.error).join('; ')
          throw new Error(`Parallel post-actions failed (blocking): ${errors}`)
        }
      }
      logger.info(`   ✅ All ${parallelActions.length} parallel actions completed`)
      break
    }

    default:
      throw new Error(
        `Unknown post-action type: "${(action as PostAction).type}". This is a configuration bug.`,
      )
  }
}
