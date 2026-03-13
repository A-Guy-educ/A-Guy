/**
 * @fileType handler
 * @domain cody | handlers
 * @pattern git-handler
 * @ai-summary Git handlers for commit and PR stages
 */

import { execFileSync } from 'child_process'

import type { PipelineContext, StageDefinition, StageResult } from '../engine/types'
import { runCommitStage, runPrStage } from '../scripted-stages'
import { getDefaultBranch } from '../git-utils'
import type { StageHandler } from './handler'

/**
 * Git commit handler
 */
export class GitCommitHandler implements StageHandler {
  async execute(_ctx: PipelineContext, _def: StageDefinition): Promise<StageResult> {
    const outputFile = `${_ctx.taskDir}/commit.md`

    const result = runCommitStage(_ctx.taskDir, outputFile)

    if (!result.success) {
      // "No changes" is OK — fix/autofix may produce no file changes.
      // Real "empty build" errors are caught by validate-src-changes post-action.
      if (result.message.includes('No changes')) {
        return { outcome: 'completed', retries: 0 }
      }
      return {
        outcome: 'failed',
        reason: result.message,
        retries: 0,
      }
    }

    return {
      outcome: 'completed',
      retries: 0,
    }
  }
}

/**
 * Git PR handler
 *
 * H3 FIX: Uses getDefaultBranch() instead of hardcoded 'origin/dev'
 * to support repos with different default branch names (main, master, etc.)
 */
export class GitPrHandler implements StageHandler {
  async execute(ctx: PipelineContext, _def: StageDefinition): Promise<StageResult> {
    const outputFile = `${ctx.taskDir}/pr.md`

    // H3 FIX: Get the actual default branch dynamically instead of hardcoding 'dev'
    const defaultBranch = getDefaultBranch()

    // Final guard: verify branch has source changes before creating PR
    // C4 FIX: Use execFileSync instead of execSync to prevent shell injection
    try {
      const diff = execFileSync('git', ['diff', '--name-only', `origin/${defaultBranch}...HEAD`], {
        encoding: 'utf-8',
      }).trim()
      const srcChanges = diff.split('\n').filter((f) => f && !f.startsWith('.tasks/'))
      if (srcChanges.length === 0) {
        return {
          outcome: 'failed',
          reason: 'No source files changed vs base branch — refusing to create empty PR',
          retries: 0,
        }
      }
    } catch {
      // Non-blocking — proceed if git check fails (e.g., shallow clone)
    }

    // R5: Pass issueNumber to link PR to the issue
    const result = await runPrStage(ctx.taskDir, outputFile, undefined, ctx.input.issueNumber, {
      fresh: ctx.input.fresh,
    })

    if (!result.created && !result.url) {
      return {
        outcome: 'failed',
        reason: result.report || 'PR creation failed',
        retries: 0,
      }
    }

    return {
      outcome: 'completed',
      retries: 0,
    }
  }
}
