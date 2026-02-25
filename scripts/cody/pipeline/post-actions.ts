/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-actions
 * @ai-summary Post-stage action runner with inlined implementations
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

import type { PipelineContext, PostAction } from '../engine/types'
import { PipelinePausedError } from '../engine/types'
import { readTask } from '../pipeline-utils'
import { commitPipelineFiles } from '../git-utils'
import { handleGateApproval } from '../clarify-workflow'
import { extractGateCommentBody, postComment } from '../github-api'

/**
 * Execute a post-action
 */
export async function executePostAction(
  ctx: PipelineContext,
  action: PostAction,
  _state: unknown,
): Promise<void> {
  switch (action.type) {
    case 'validate-task-json': {
      try {
        readTask(ctx.taskDir)
        console.log('  ✓ task.json validated')
      } catch (error) {
        // G13: Delete invalid file so retry can recreate
        const taskJsonPath = path.join(ctx.taskDir, 'task.json')
        if (fs.existsSync(taskJsonPath)) {
          fs.unlinkSync(taskJsonPath)
        }
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid task.json: ${msg}`)
      }
      break
    }

    case 'resolve-profile': {
      const taskDef = readTask(ctx.taskDir)
      if (taskDef) {
        // Update ctx.taskDef so subsequent post-actions can access it
        ctx.taskDef = taskDef
        const { resolvePipelineProfile } = await import('../pipeline-utils')
        ctx.profile = resolvePipelineProfile(taskDef)
        // Signal engine to rebuild pipeline with new profile (two-phase construction)
        ctx.pipelineNeedsRebuild = true
        console.log(`  ℹ️ Resolved profile: ${ctx.profile}`)
      }
      break
    }

    case 'check-gate': {
      // BUG-F fix: taskDef might be null if resolve-profile hasn't run yet
      const taskDef = ctx.taskDef ?? readTask(ctx.taskDir)
      if (!taskDef) {
        throw new Error(`Cannot check gate "${action.gate}": task.json not found or invalid`)
      }
      const gateResult = handleGateApproval(ctx.input, ctx.taskDir, action.gate, taskDef)
      if (gateResult === 'waiting') {
        // Read gate file and extract comment body
        const gateFilePath = path.join(ctx.taskDir, `gate-${action.gate}.md`)
        if (fs.existsSync(gateFilePath)) {
          const gateContent = fs.readFileSync(gateFilePath, 'utf-8')
          const commentBody = extractGateCommentBody(gateContent)
          if (ctx.input.issueNumber && commentBody) {
            postComment(ctx.input.issueNumber, commentBody)
          }
        }
        // Commit and pause
        commitPipelineFiles({
          taskDir: ctx.taskDir,
          taskId: ctx.taskId,
          message: `ci(cody): pause at ${action.gate} gate for ${ctx.taskId}`,
          ensureBranch: true,
          stagingStrategy: 'task-only',
          push: true,
          isCI: !ctx.input.local,
          dryRun: ctx.input.dryRun,
        })
        throw new PipelinePausedError(`${action.gate} gate: awaiting approval for ${ctx.taskId}`)
      }
      if (gateResult === 'rejected') {
        throw new Error(`Task rejected at ${action.gate} gate`)
      }
      break
    }

    case 'commit-task-files': {
      // G18: Skip if localOnly and not in local mode
      if (action.localOnly && !ctx.input.local) {
        return
      }
      // Skip if dryRun
      if (ctx.input.dryRun) {
        return
      }

      commitPipelineFiles({
        taskDir: ctx.taskDir,
        taskId: ctx.taskId,
        message: action.commitMessage || `ci(cody): commit task files for ${ctx.taskId}`,
        ensureBranch: action.ensureBranch,
        cleanDirtyState: action.cleanDirtyState,
        stagingStrategy: action.stagingStrategy === 'tracked-only' ? 'all' : action.stagingStrategy,
        push: action.push,
        isCI: !ctx.input.local,
        dryRun: ctx.input.dryRun,
      })
      break
    }

    case 'archive-rerun-feedback': {
      const rerunFeedbackPath = path.join(ctx.taskDir, 'rerun-feedback.md')
      if (fs.existsSync(rerunFeedbackPath)) {
        const consumed = path.join(ctx.taskDir, 'rerun-feedback.consumed.md')
        fs.renameSync(rerunFeedbackPath, consumed)
        console.log('   Consumed rerun-feedback.md')
      }
      break
    }

    case 'validate-plan-exists': {
      const planFile = path.join(ctx.taskDir, 'plan.md')
      const gapFile = path.join(ctx.taskDir, 'gap.md')

      if (!fs.existsSync(planFile)) {
        throw new Error('plan.md not found - gap agent may have deleted it')
      }

      const gapContent = fs.existsSync(gapFile) ? fs.readFileSync(gapFile, 'utf-8') : ''

      // Basic validation - check for expected sections
      if (!gapContent.includes('## ') && !gapContent.includes('No gaps identified')) {
        throw new Error('gap.md must contain ## sections or "No gaps identified"')
      }
      break
    }

    case 'validate-build-content': {
      const buildFile = path.join(ctx.taskDir, 'build.md')
      if (!fs.existsSync(buildFile)) {
        throw new Error('build.md not found')
      }

      const buildContent = fs.readFileSync(buildFile, 'utf-8')

      // Check for required sections
      if (!buildContent.includes('## Changes') && !buildContent.includes('## Files')) {
        throw new Error('build.md must contain ## Changes or ## Files section')
      }
      break
    }

    case 'run-tsc': {
      if (ctx.input.dryRun) return

      console.log('   Running tsc...')
      try {
        execSync('pnpm -s tsc --noEmit', { stdio: 'inherit' })
        console.log('   ✓ tsc passed')
      } catch {
        throw new Error('TypeScript compilation failed')
      }
      break
    }

    case 'run-unit-tests': {
      if (ctx.input.dryRun) return

      console.log('   Running unit tests...')
      try {
        execSync('pnpm -s test:unit', { stdio: 'inherit' })
        console.log('   ✓ Unit tests passed')
      } catch (error) {
        // G25: Include output text (3000 chars) for supervisor retry
        const err = error as { stdout?: string; stderr?: string; message?: string }
        const output = (err.stdout || '') + (err.stderr || '') + (err.message || '')
        throw new Error(
          `Unit tests failed after build. Fix and re-run.\n\n${output.slice(0, 3000)}`,
        )
      }
      break
    }

    case 'commit-audit-history': {
      // G18: Skip if localOnly and not in local mode
      if (!ctx.input.local) {
        return
      }
      if (ctx.input.dryRun) {
        return
      }

      const auditHistoryPath = path.join(process.cwd(), '.tasks', 'audit-history.json')
      if (fs.existsSync(auditHistoryPath)) {
        commitPipelineFiles({
          taskDir: '.tasks',
          taskId: 'audit-history',
          message: `audit: update audit history from ${ctx.taskId}`,
          stagingStrategy: 'task-only',
          push: false,
          dryRun: ctx.input.dryRun,
        })
      }
      break
    }

    default:
      console.warn(`Unknown post-action type: ${(action as PostAction).type}`)
  }
}
