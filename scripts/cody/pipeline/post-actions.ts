/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-actions
 * @ai-summary Post-stage action runner with inlined implementations
 */

import { logger } from '../logger'
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

import type { PipelineContext, PostAction, PipelineStateV2 } from '../engine/types'
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
  setClassificationLabels,
  setProfileLabel,
} from '../github-api'
import { updateStage, completeState, writeState, appendActorEvent } from '../engine/status'
import { classifyError, formatErrorsAsMarkdown } from './error-classifier'
import { runAgentWithFileWatch } from '../agent-runner'
import { getStageTimeout } from '../stages/registry'

/**
 * Execute a post-action
 */
export async function executePostAction(
  ctx: PipelineContext,
  action: PostAction,
  _state: PipelineStateV2 | null,
): Promise<void> {
  switch (action.type) {
    case 'validate-task-json': {
      try {
        readTask(ctx.taskDir)
        logger.info('  ✓ task.json validated')
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

    case 'set-classification-labels': {
      // Set classification labels from task.json (type, risk, complexity, domain)
      const taskDef = readTask(ctx.taskDir)
      if (ctx.input.issueNumber && taskDef) {
        setClassificationLabels(ctx.input.issueNumber, {
          task_type: taskDef.task_type,
          risk_level: taskDef.risk_level,
          complexity: taskDef.complexity,
          primary_domain: taskDef.primary_domain,
        })
      }
      break
    }

    case 'resolve-profile': {
      const taskDef = readTask(ctx.taskDir)
      if (taskDef) {
        // Apply --complexity override if provided (for testing/debugging)
        if (ctx.input.complexityOverride !== undefined) {
          const oldComplexity = taskDef.complexity
          taskDef.complexity = ctx.input.complexityOverride
          taskDef.complexity_reasoning = `Override via --complexity=${ctx.input.complexityOverride}`
          if (oldComplexity !== undefined) {
            logger.info(
              `  ℹ️ Complexity override: ${oldComplexity} → ${ctx.input.complexityOverride}`,
            )
          } else {
            logger.info(`  ℹ️ Complexity override applied: ${ctx.input.complexityOverride}`)
          }
        }
        // Update ctx.taskDef so subsequent post-actions can access it
        ctx.taskDef = taskDef
        const { resolvePipelineProfile, getComplexityTier } = await import('../pipeline-utils')
        ctx.profile = resolvePipelineProfile(taskDef)
        // Set profile label on the issue
        if (ctx.input.issueNumber) {
          setProfileLabel(ctx.input.issueNumber, ctx.profile)
        }
        // Signal engine to rebuild pipeline with new profile (two-phase construction)
        ctx.pipelineNeedsRebuild = true
        if (taskDef.complexity !== undefined) {
          const tier = getComplexityTier(taskDef.complexity)
          logger.info(`  ℹ️ Complexity: ${taskDef.complexity} (${tier}) → profile: ${ctx.profile}`)

          // R2-FIX #6: Warn when complexity seems mismatched with profile.
          // A lightweight profile with high complexity may skip important stages.
          if (ctx.profile === 'lightweight' && taskDef.complexity >= 35) {
            logger.warn(
              `  ⚠️ Profile/complexity mismatch: lightweight profile with complexity ${taskDef.complexity} (complex tier). ` +
                `Some stages may be unexpectedly skipped. Consider overriding with --profile=standard.`,
            )
          }
        } else {
          logger.info(
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
            logger.info(`  ℹ️ Created promoted stub: ${stage}.md`)
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
        logger.info(`  ✓ gate ${action.gate} skipped (controlMode: auto)`)
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
        const currentState = _state
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
        // Record gate rejection actor event
        if (ctx.actor && _state) {
          appendActorEvent(ctx.taskId, _state, {
            action: 'gate-rejected',
            actor: ctx.actor,
            timestamp: new Date().toISOString(),
            stage: action.gate,
          })
        }
        throw new Error(`Task rejected at ${action.gate} gate`)
      }
      // Approved - remove gate label so dashboard shows it's no longer waiting
      if (ctx.input.issueNumber) {
        removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.HARD_STOP)
        removeIssueLabel(ctx.input.issueNumber, GATE_LABELS.RISK_GATED)
      }
      // Record gate approval actor event
      if (ctx.actor && _state) {
        appendActorEvent(ctx.taskId, _state, {
          action: 'gate-approved',
          actor: ctx.actor,
          timestamp: new Date().toISOString(),
          stage: action.gate,
        })
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
        logger.info('   Consumed rerun-feedback.md')
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

    case 'validate-src-changes': {
      if (ctx.input.dryRun) return

      // Check that the build agent actually modified source files, not just .tasks/
      let diff = ''
      let untracked = ''
      let gitFailed = false
      try {
        diff = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf-8' }).trim()
      } catch (error) {
        logger.error({ err: error }, 'git diff failed during src validation')
        gitFailed = true
      }
      try {
        untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
          encoding: 'utf-8',
        }).trim()
      } catch (error) {
        logger.error({ err: error }, 'git ls-files failed during src validation')
        gitFailed = true
      }

      if (gitFailed) {
        throw new Error(
          'validate-src-changes: git commands failed — cannot verify source changes. Check git state.',
        )
      }

      const allChanged = [...diff.split('\n'), ...untracked.split('\n')]
        .filter(Boolean)
        .filter((f) => !f.startsWith('.tasks/'))

      if (allChanged.length === 0) {
        throw new Error(
          'Build agent wrote build.md but did NOT modify any source files. ' +
            'The agent must use Edit/Write tools to implement actual code changes, not just document them in build.md.',
        )
      }

      logger.info(`   ✓ ${allChanged.length} source file(s) changed by build agent`)
      break
    }

    case 'run-tsc': {
      if (ctx.input.dryRun) return

      logger.info('   Running tsc...')
      try {
        execFileSync('pnpm', ['-s', 'tsc', '--noEmit'], {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
        })
        logger.info('   ✓ tsc passed')
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string }
        const output = (err.stdout || '') + (err.stderr || '') || err.message || ''
        throw new Error(`TypeScript compilation failed:\n${output.slice(0, 3000)}`)
      }
      break
    }

    case 'run-unit-tests': {
      if (ctx.input.dryRun) return

      logger.info('   Running unit tests...')
      try {
        execFileSync('pnpm', ['-s', 'test:unit'], {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
        })
        logger.info('   ✓ Unit tests passed')
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

    case 'run-quality-with-autofix': {
      if (ctx.input.dryRun) return

      type GateResult = {
        name: string
        command: string
        source: 'tsc' | 'lint' | 'format' | 'test'
        passed: boolean
        error?: string
      }

      // Helper: split a simple shell command into program + args for execFileSync
      const parseCommand = (cmd: string): { program: string; args: string[] } => {
        const parts = cmd.split(/\s+/).filter(Boolean)
        return { program: parts[0], args: parts.slice(1) }
      }

      const runGates = (gates: typeof action.gates): GateResult[] => {
        return gates.map((gate) => {
          try {
            logger.info(`   Running ${gate.name}...`)
            const { program, args } = parseCommand(gate.command)
            execFileSync(program, args, {
              stdio: 'pipe',
              timeout: 5 * 60 * 1000, // 5 minutes per gate
              maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            })
            logger.info(`   ✓ ${gate.name} passed`)
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
            logger.info(`   ✗ ${gate.name} failed`)
            const truncated = output.slice(-2000).trim()
            if (truncated) {
              logger.info(`   Error output (last 2000 chars):\n${truncated}`)
            }
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

      // Build agent feedback loop — the build agent wrote the code, so it fixes
      // ALL failures (tsc, lint, format, tests). No separate autofix agent needed
      // here because the build agent has full context (spec, plan, code intent).
      for (let attempt = 1; attempt <= action.maxFeedbackLoops; attempt++) {
        logger.info(
          `\n🔧 Build agent fix attempt ${attempt}/${action.maxFeedbackLoops} (${failures.map((f) => f.name).join(', ')})...`,
        )

        // Classify errors and write build-errors.md for the build agent to read
        const errors = failures.map((f) => classifyError(f.error || '', f.source))
        errors.forEach((e) => encounteredErrors.add(e.category))
        completedLoops = attempt
        const markdown = formatErrorsAsMarkdown(errors, attempt, action.maxFeedbackLoops)
        const errorsFile = path.join(ctx.taskDir, 'build-errors.md')
        fs.writeFileSync(errorsFile, markdown)

        // Re-invoke the build agent — it has spec, plan, and wrote the code
        const buildOutput = path.join(ctx.taskDir, 'build.md')
        const buildTimeout = getStageTimeout('build')
        let buildResult: { succeeded: boolean } | undefined
        try {
          buildResult = await runAgentWithFileWatch(ctx.input, 'build', buildOutput, buildTimeout, {
            backend: ctx.backend,
          })
        } catch (agentError) {
          logger.error(
            { err: agentError },
            `  ❌ Build agent threw exception (fix attempt ${attempt}/${action.maxFeedbackLoops})`,
          )
          continue
        }

        if (!buildResult?.succeeded) {
          logger.error(`  ❌ Build agent failed (fix attempt ${attempt})`)
          continue
        }

        // Re-run ALL gates after build agent changes
        results = runGates(action.gates)
        failures = results.filter((r) => !r.passed)

        if (failures.length === 0) {
          logger.info(`  ✅ All quality gates passed after build agent fix attempt ${attempt}`)
          if (fs.existsSync(errorsFile)) fs.unlinkSync(errorsFile)
          break
        }
      }

      // Record feedback loop metrics in status.json for observability
      if (completedLoops > 0) {
        const currentState = _state
        if (currentState && currentState.stages?.build) {
          const updatedState = updateStage(currentState, 'build', {
            feedbackLoops: completedLoops,
            feedbackErrors: Array.from(encounteredErrors),
          })
          writeState(ctx.taskId, updatedState)
        }
      }

      if (failures.length > 0) {
        const errorsFile = path.join(ctx.taskDir, 'build-errors.md')
        if (fs.existsSync(errorsFile)) fs.unlinkSync(errorsFile)
        const failedNames = failures.map((f) => f.name).join(', ')
        throw new Error(
          `Quality gates failed after ${action.maxFeedbackLoops} build agent fix attempts: ${failedNames}`,
        )
      }
      break
    }

    case 'analyze-review-findings': {
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
      const state = _state
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
      break
    }

    case 'run-mechanical-autofix': {
      // Run lint:fix + format:fix deterministically — no LLM needed for mechanical fixes.
      // This prevents trivial format/lint failures from reaching verify stage.
      if (ctx.input.dryRun) return

      logger.info('  🔧 Running mechanical auto-fix (lint:fix + format:fix)...')

      try {
        execFileSync('pnpm', ['lint:fix'], {
          stdio: 'pipe',
          timeout: 2 * 60 * 1000, // 2 minutes
          maxBuffer: 10 * 1024 * 1024,
        })
        logger.info('   ✓ lint:fix completed')
      } catch {
        logger.info('   ✗ lint:fix had errors (some may need manual fix)')
      }

      try {
        execFileSync('pnpm', ['format:fix'], {
          stdio: 'pipe',
          timeout: 2 * 60 * 1000, // 2 minutes
          maxBuffer: 10 * 1024 * 1024,
        })
        logger.info('   ✓ format:fix completed')
      } catch {
        logger.info('   ✗ format:fix had errors (some may need manual fix)')
      }

      logger.info('  ✅ Mechanical auto-fix complete')
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

    case 'parallel': {
      if (!('actions' in action) || !Array.isArray((action as { actions?: unknown }).actions)) {
        throw new Error(`'parallel' post-action missing required 'actions' array`)
      }
      const parallelActions = (action as { actions: PostAction[] }).actions
      logger.info(`   Running ${parallelActions.length} actions in parallel...`)

      const results = await Promise.allSettled(
        parallelActions.map(async (a) => {
          // Recursively execute each action
          await executePostAction(ctx, a, _state)
        }),
      )

      // Check for PipelinePausedError first — re-throw it directly to preserve the type
      const pauseResult = results.find(
        (r): r is PromiseRejectedResult =>
          r.status === 'rejected' && r.reason instanceof PipelinePausedError,
      )
      if (pauseResult) {
        throw pauseResult.reason // Preserve PipelinePausedError type for caller
      }

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
      logger.info(`   ✅ All ${parallelActions.length} parallel actions completed`)
      break
    }

    default:
      throw new Error(
        `Unknown post-action type: "${(action as PostAction).type}". This is a configuration bug.`,
      )
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
