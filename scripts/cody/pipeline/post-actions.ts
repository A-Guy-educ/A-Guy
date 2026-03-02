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
import {
  extractGateCommentBody,
  postComment,
  addIssueLabel,
  removeIssueLabel,
  GATE_LABELS,
} from '../github-api'
import { loadState, updateStage, completeState, writeState } from '../engine/status'
import { classifyError, formatErrorsAsMarkdown } from './error-classifier'
import { runAgentWithFileWatch, STAGE_TIMEOUTS, DEFAULT_TIMEOUT } from '../agent-runner'

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
        // Apply --complexity override if provided (for testing/debugging)
        if (ctx.input.complexityOverride !== undefined && taskDef.complexity === undefined) {
          taskDef.complexity = ctx.input.complexityOverride
          taskDef.complexity_reasoning = `Override via --complexity=${ctx.input.complexityOverride}`
          console.log(`  ℹ️ Applied complexity override: ${ctx.input.complexityOverride}`)
        }
        // Update ctx.taskDef so subsequent post-actions can access it
        ctx.taskDef = taskDef
        const { resolvePipelineProfile, getComplexityTier } = await import('../pipeline-utils')
        ctx.profile = resolvePipelineProfile(taskDef)
        // Signal engine to rebuild pipeline with new profile (two-phase construction)
        ctx.pipelineNeedsRebuild = true
        if (taskDef.complexity !== undefined) {
          const tier = getComplexityTier(taskDef.complexity)
          console.log(`  ℹ️ Complexity: ${taskDef.complexity} (${tier}) → profile: ${ctx.profile}`)
        } else {
          console.log(
            `  ℹ️ Resolved profile: ${ctx.profile} (no complexity score, using legacy heuristic)`,
          )
        }

        // Create stub promoted files for stages in skip_stages
        // The skip condition checks file existence, so we must ensure the file exists
        // Stubs must include sections that downstream validators expect
        const skipStages = taskDef.input_quality?.skip_stages ?? []
        for (const stage of skipStages) {
          const outputFile = path.join(ctx.taskDir, `${stage}.md`)
          if (!fs.existsSync(outputFile)) {
            const stub = buildPromotedStub(stage, ctx.taskDir)
            fs.writeFileSync(outputFile, stub)
            console.log(`  ℹ️ Created promoted stub: ${stage}.md`)
          }
        }
      }
      break
    }

    case 'check-gate': {
      // BUG-F fix: taskDef might be null if resolve-profile hasn't run yet
      const taskDef = ctx.taskDef ?? readTask(ctx.taskDir)
      if (!taskDef) {
        throw new Error(`Cannot check gate "${action.gate}": task.json not found or invalid`)
      }
      // Skip gate when controlMode is 'auto' (low risk tasks don't need approval)
      const { resolveControlMode } = await import('../pipeline-utils')
      const controlMode = resolveControlMode(taskDef, ctx.input.controlMode)
      if (controlMode === 'auto') {
        console.log(`  ✓ gate ${action.gate} skipped (controlMode: auto)`)
        break
      }
      const gateResult = handleGateApproval(ctx.input, ctx.taskDir, action.gate, taskDef)

      // Determine gate label based on risk level
      const gateLabel =
        taskDef.risk_level === 'high' ? GATE_LABELS.HARD_STOP : GATE_LABELS.RISK_GATED

      if (gateResult === 'waiting') {
        // Add gate label for dashboard visibility
        if (ctx.input.issueNumber) {
          addIssueLabel(ctx.input.issueNumber, gateLabel)
        }
        // Read gate file and extract comment body
        const gateFilePath = path.join(ctx.taskDir, `gate-${action.gate}.md`)
        if (fs.existsSync(gateFilePath)) {
          const gateContent = fs.readFileSync(gateFilePath, 'utf-8')
          const commentBody = extractGateCommentBody(gateContent)
          if (ctx.input.issueNumber && commentBody) {
            postComment(ctx.input.issueNumber, commentBody)
          }
        }
        // Pre-write paused state to status.json BEFORE commit+push,
        // so the persisted status.json on the branch reflects 'paused' (not 'running').
        // The state machine will also set paused after PipelinePausedError, but that
        // only writes locally — the commit here is what the next CI run reads.
        const currentState = loadState(ctx.taskId)
        if (currentState) {
          let pausedState = updateStage(currentState, action.gate, { state: 'paused' })
          pausedState = completeState(pausedState, 'paused')
          writeState(ctx.taskId, pausedState)
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
        // Remove gate label when rejected
        if (ctx.input.issueNumber) {
          removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.HARD_STOP)
          removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.RISK_GATED)
        }
        throw new Error(`Task rejected at ${action.gate} gate`)
      }
      // Approved - remove gate label so dashboard shows it's no longer waiting
      if (ctx.input.issueNumber) {
        removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.HARD_STOP)
        removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.RISK_GATED)
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

    case 'run-quality-with-autofix': {
      if (ctx.input.dryRun) return

      type GateResult = {
        name: string
        command: string
        source: 'tsc' | 'lint' | 'format' | 'test'
        passed: boolean
        error?: string
      }

      const runGates = (gates: typeof action.gates): GateResult[] => {
        return gates.map((gate) => {
          try {
            console.log(`   Running ${gate.name}...`)
            execSync(gate.command, { stdio: 'pipe' })
            console.log(`   ✓ ${gate.name} passed`)
            return { ...gate, passed: true }
          } catch (error) {
            const err = error as {
              stdout?: Buffer | string
              stderr?: Buffer | string
              message?: string
            }
            const stdout = err.stdout
              ? Buffer.isBuffer(err.stdout)
                ? err.stdout.toString()
                : err.stdout
              : ''
            const stderr = err.stderr
              ? Buffer.isBuffer(err.stderr)
                ? err.stderr.toString()
                : err.stderr
              : ''
            const output = stdout + stderr + (err.message || '')
            console.log(`   ✗ ${gate.name} failed`)
            return { ...gate, passed: false, error: output }
          }
        })
      }

      // Initial run — all gates
      let results = runGates(action.gates)
      let failures = results.filter((r) => !r.passed)

      if (failures.length === 0) break // All passed on first try

      // Track feedback loop metrics for status.json observability
      let completedLoops = 0
      const encounteredErrors = new Set<string>()

      // Autofix feedback loop
      // Note: No commit/push after autofix here — the pipeline's 'commit' stage
      // immediately follows 'build' and handles committing all working tree changes.
      // This differs from scripted-handler.ts (verify autofix) which commits because
      // it runs after the commit stage.
      for (let attempt = 1; attempt <= action.maxFeedbackLoops; attempt++) {
        console.log(`
🔧 Build autofix attempt ${attempt}/${action.maxFeedbackLoops}...`)

        // Classify errors and write build-errors.md
        const errors = failures.map((f) => classifyError(f.error || '', f.source))
        errors.forEach((e) => encounteredErrors.add(e.category))
        completedLoops = attempt
        const markdown = formatErrorsAsMarkdown(errors, attempt, action.maxFeedbackLoops)
        const errorsFile = path.join(ctx.taskDir, 'build-errors.md')
        fs.writeFileSync(errorsFile, markdown)

        // Run autofix agent
        const autofixOutput = path.join(ctx.taskDir, 'autofix.md')
        if (fs.existsSync(autofixOutput)) {
          fs.unlinkSync(autofixOutput)
        }
        const autofixTimeout = STAGE_TIMEOUTS.autofix ?? DEFAULT_TIMEOUT
        const autofixResult = await runAgentWithFileWatch(
          ctx.input,
          'autofix',
          autofixOutput,
          autofixTimeout,
          { backend: ctx.backend },
        )

        if (!autofixResult.succeeded) {
          console.error(`  ❌ Autofix agent failed (attempt ${attempt})`)
          continue
        }

        // Re-run ONLY failed gates
        const failedGateSpecs = failures.map((f) => ({
          name: f.name,
          command: f.command,
          source: f.source,
        }))
        results = runGates(failedGateSpecs)
        failures = results.filter((r) => !r.passed)

        if (failures.length === 0) {
          console.log(`  ✅ All quality gates passed after autofix attempt ${attempt}`)
          // Clean up build-errors.md since everything passed
          if (fs.existsSync(errorsFile)) {
            fs.unlinkSync(errorsFile)
          }
          break
        }
      }

      // Record feedback loop metrics in status.json for observability (immutable update)
      if (completedLoops > 0) {
        const currentState = loadState(ctx.taskId)
        if (currentState && currentState.stages?.build) {
          const updatedState = updateStage(currentState, 'build', {
            feedbackLoops: completedLoops,
            feedbackErrors: Array.from(encounteredErrors),
          })
          writeState(ctx.taskId, updatedState)
        }
      }

      if (failures.length > 0) {
        const failedNames = failures.map((f) => f.name).join(', ')
        throw new Error(
          `Quality gates failed after ${action.maxFeedbackLoops} autofix attempts: ${failedNames}`,
        )
      }
      break
    }

    case 'parallel': {
      const parallelActions = (action as unknown as { actions: PostAction[] }).actions
      console.log(`   Running ${parallelActions.length} actions in parallel...`)

      const results = await Promise.allSettled(
        parallelActions.map(async (a) => {
          // Recursively execute each action
          await executePostAction(ctx, a, null as unknown as never)
        }),
      )

      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        const errors = failures
          .map((f) => {
            const err = f.reason as Error
            return err?.message || String(f.reason)
          })
          .join('; ')
        throw new Error(`Parallel post-actions failed: ${errors}`)
      }
      console.log(`   ✅ All ${parallelActions.length} parallel actions completed`)
      break
    }

    default:
      console.warn(`Unknown post-action type: ${(action as PostAction).type}`)
  }
}

/**
 * Build a promoted stub file for a skipped stage.
 * Includes sections that downstream validators expect.
 */
function buildPromotedStub(stage: string, taskDir: string): string {
  const title = stage.charAt(0).toUpperCase() + stage.slice(1)

  if (stage === 'spec') {
    // Gap validator checks for ## Requirements or ## Acceptance Criteria
    // Pull description from task.md if available
    const taskMdPath = path.join(taskDir, 'task.md')
    let description = 'See task.md and task.json for full details.'
    if (fs.existsSync(taskMdPath)) {
      description = fs.readFileSync(taskMdPath, 'utf-8')
    }
    return `# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

${description}

## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
`
  }

  if (stage === 'architect' || stage === 'plan-gap') {
    // Build stage reads plan.md; plan-gap validator checks plan.md exists
    return `# ${title} (promoted)

Skipped via input_quality — taskify determined this stage is unnecessary.
See task.json input_quality.reasoning for details.

## Changes

See task.md for implementation details.
`
  }

  // Generic stub for other stages
  return `# ${title} (promoted)

Skipped via input_quality — taskify determined this stage is unnecessary.
See task.json input_quality.reasoning for details.
`
}
