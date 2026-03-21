/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Quality gate lifecycle events — runs tsc, unit tests, and autofix feedback loops.
 *   Also includes mechanical autofix (lint:fix + format:fix).
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

import { logger } from '../../logger'
import type { PipelineContext, PostAction, PipelineStateV2 } from '../../engine/types'
import { updateStage, writeState } from '../../engine/status'
import { classifyError, formatErrorsAsMarkdown } from '../error-classifier'
import { runAgentWithFileWatch } from '../../agent-runner'
import { getStageTimeout } from '../../stages/registry'

export async function executeRunTsc(ctx: PipelineContext): Promise<void> {
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
}

export async function executeRunUnitTests(ctx: PipelineContext): Promise<void> {
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
    throw new Error(`Unit tests failed after build. Fix and re-run.\n\n${output.slice(0, 3000)}`)
  }
}

export async function executeRunQualityWithAutofix(
  ctx: PipelineContext,
  action: PostAction & { type: 'run-quality-with-autofix' },
  state: PipelineStateV2 | null,
): Promise<void> {
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

  if (failures.length === 0) return // All passed on first try

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
    const currentState = state
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
}

export async function executeRunMechanicalAutofix(ctx: PipelineContext): Promise<void> {
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
}
