#!/usr/bin/env ts-node
/**
 * @fileType script
 * @domain ci | pipeline
 * @pattern orchestrated-pipeline
 * @ai-summary Central orchestration logic for running multi-agent pipeline in CI via OpenCode GitHub mode
 *
 * Usage:
 *   pnpm pipeline:orchestrate --task-id=<task-id> --mode=<spec|impl|rerun|full|status> [options]
 *
 * This script runs in CI and orchestrates OpenCode agents via `opencode github run --agent <stage>`.
 * It handles:
 * - Input parsing and validation
 * - Auth validation (OPENCODE_GITHUB_TOKEN)
 * - Pipeline stage execution with timeouts and retries
 * - Status tracking (status.json)
 * - Comment posting to GitHub issues
 */

import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Import utilities from orchestrator-utils
import {
  parseCliArgs,
  validateAuth,
  ensureTaskDir,
  initStatus,
  updateStageStatus,
  completeStatus,
  readStatus,
  postComment,
  formatStatusComment,
  type OrchestratorInput,
} from './orchestrator-utils'

// Import from existing pipeline-utils (reusing existing logic)
import {
  writeAgentContext,
  readTask,
  stageOutputFile,
  SPEC_EXECUTE_VERIFY_STAGES,
} from './pipeline-utils'

// ============================================================================
// Configuration
// ============================================================================

const FILE_POLL_INTERVAL = 3_000 // check every 3 seconds
const FILE_SETTLE_DELAY = 2_000 // wait 2s after file appears
const MAX_RETRIES = 2

// Stage timeouts (ms)
const STAGE_TIMEOUTS: Record<string, number> = {
  architect: 5 * 60_000,
  build: 30 * 60_000,
  test: 10 * 60_000,
  verify: 5 * 60_000,
  auditor: 5 * 60_000,
  pr: 5 * 60_000,
}
const DEFAULT_TIMEOUT = 10 * 60_000

// ============================================================================
// Main Entry
// ============================================================================

async function main() {
  console.log('=== Orchestrated Pipeline ===\n')

  // Parse CLI arguments
  let input: OrchestratorInput
  try {
    input = parseCliArgs(process.argv.slice(2))
  } catch (error) {
    console.error('❌ Failed to parse arguments:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  console.log(`Task: ${input.taskId}`)
  console.log(`Mode: ${input.mode}`)
  console.log(`Dry run: ${input.dryRun}`)
  if (input.issueNumber) console.log(`Issue: #${input.issueNumber}`)
  console.log('')

  // Validate GitHub App authentication
  validateAuth()

  // Ensure task directory exists
  ensureTaskDir(input.taskId)

  // Initialize status
  const status = initStatus(input)

  // Route based on mode
  try {
    switch (input.mode) {
      case 'spec':
        await runSpecPipeline(input, status)
        break
      case 'impl':
        await runImplPipeline(input, status)
        break
      case 'full':
        await runFullPipeline(input, status)
        break
      case 'rerun':
        await runRerunPipeline(input, status)
        break
      case 'status':
        await showStatus(input)
        break
      default:
        throw new Error(`Unknown mode: ${input.mode}`)
    }

    completeStatus(input.taskId, 'completed')
    console.log('\n✅ Pipeline completed successfully')

    if (input.issueNumber) {
      postComment(input.issueNumber, formatStatusComment(input, status))
    }
  } catch (error) {
    completeStatus(input.taskId, 'failed')
    console.error('\n❌ Pipeline failed:', error instanceof Error ? error.message : error)

    if (input.issueNumber) {
      postComment(
        input.issueNumber,
        `❌ Pipeline failed for \`${input.taskId}\`: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
    process.exit(1)
  }
}

// ============================================================================
// Pipeline Modes
// ============================================================================

async function runSpecPipeline(
  input: OrchestratorInput,
  _status: ReturnType<typeof initStatus>, // Status is updated via updateStageStatus
): Promise<void> {
  console.log('Running SPEC pipeline (Phase 1)...\n')

  // Check task.md exists
  const taskDir = ensureTaskDir(input.taskId)
  const taskMdPath = path.join(taskDir, 'task.md')

  if (!fs.existsSync(taskMdPath)) {
    throw new Error(`task.md not found in .tasks/${input.taskId}/. Create it first.`)
  }

  const stages = ['taskify', 'spec', 'clarify']

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

    // Skip if output exists (unless this is a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      continue
    }

    console.log(`[${i + 1}/${stages.length}] Running ${stage}...`)

    // Update status
    updateStageStatus(input.taskId, stage, 'running')

    // Write context
    writeAgentContext(taskDir)

    if (input.dryRun) {
      updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
      continue
    }

    // Run agent
    const result = await runAgentWithFileWatch(input, stage, outputFile)

    if (result.timedOut) {
      updateStageStatus(input.taskId, stage, 'timeout', { retries: result.retries })
      throw new Error(`Stage "${stage}" timed out`)
    }

    if (!result.succeeded) {
      updateStageStatus(input.taskId, stage, 'failed', { retries: result.retries })
      throw new Error(`Stage "${stage}" failed`)
    }

    updateStageStatus(input.taskId, stage, 'completed', {
      retries: result.retries,
      outputFile: path.basename(outputFile),
    })
    console.log(`✓ ${stage} complete`)
  }

  // Create clarified.md if needed (for impl pipeline)
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
  }

  console.log('\n✅ Spec pipeline complete')
}

async function runImplPipeline(
  input: OrchestratorInput,
  _status: ReturnType<typeof initStatus>, // Status is updated via updateStageStatus
): Promise<void> {
  console.log('Running IMPLEMENTATION pipeline (Phase 2)...\n')

  const taskDir = ensureTaskDir(input.taskId)

  // Validate clarified.md exists
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    throw new Error(`clarified.md not found. Run spec pipeline first or create it.`)
  }

  // Get task definition
  const taskDef = readTask(taskDir)
  if (!taskDef) {
    throw new Error(`task.json not found. Run spec pipeline first.`)
  }

  // Determine stages based on task type
  let stages = [...SPEC_EXECUTE_VERIFY_STAGES]

  // Skip auditor on reruns
  if (fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))) {
    stages = stages.filter((s) => s !== 'auditor')
  }

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

    // Skip if output exists (not a re-run)
    if (fs.existsSync(outputFile)) {
      console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
      updateStageStatus(input.taskId, stage, 'completed', { outputFile: path.basename(outputFile) })
      continue
    }

    console.log(`[${i + 1}/${stages.length}] Running ${stage}...`)

    // Update status
    updateStageStatus(input.taskId, stage, 'running')

    // Write context
    writeAgentContext(taskDir)

    if (input.dryRun) {
      updateStageStatus(input.taskId, stage, 'completed', { retries: 0 })
      continue
    }

    // Run agent with timeout
    const timeout = STAGE_TIMEOUTS[stage] ?? DEFAULT_TIMEOUT
    const result = await runAgentWithFileWatch(input, stage, outputFile, timeout)

    if (result.timedOut) {
      updateStageStatus(input.taskId, stage, 'timeout', { retries: result.retries })
      throw new Error(`Stage "${stage}" timed out after ${Math.round(timeout / 60000)} minutes`)
    }

    if (!result.succeeded) {
      updateStageStatus(input.taskId, stage, 'failed', { retries: result.retries })
      throw new Error(`Stage "${stage}" failed after ${result.retries} retries`)
    }

    updateStageStatus(input.taskId, stage, 'completed', {
      retries: result.retries,
      outputFile: path.basename(outputFile),
    })
    console.log(`✓ ${stage} complete`)
  }

  console.log('\n✅ Implementation pipeline complete')
}

async function runFullPipeline(
  input: OrchestratorInput,
  status: ReturnType<typeof initStatus>,
): Promise<void> {
  console.log('Running FULL pipeline (spec + impl)...\n')

  // Run spec first
  await runSpecPipeline(input, status)

  // Then impl
  await runImplPipeline(input, status)

  console.log('\n✅ Full pipeline complete!')
}

async function runRerunPipeline(
  input: OrchestratorInput,
  status: ReturnType<typeof initStatus>,
): Promise<void> {
  console.log('Running RERUN pipeline...\n')

  if (!input.fromStage) {
    input.fromStage = 'build'
  }

  if (!input.feedback) {
    throw new Error('--feedback is required for rerun mode')
  }

  const taskDir = ensureTaskDir(input.taskId)

  // Write feedback file
  const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
  fs.writeFileSync(
    feedbackFile,
    `# Rerun Feedback - ${new Date().toISOString()}\n\n## Issues Found\n\n${input.feedback}\n`,
  )

  console.log(`Feedback: ${input.feedback}`)
  console.log(`From stage: ${input.fromStage}\n`)

  // Delete stage files from rerun point onwards
  const fromIndex = SPEC_EXECUTE_VERIFY_STAGES.indexOf(input.fromStage)
  const stagesToDelete = SPEC_EXECUTE_VERIFY_STAGES.slice(fromIndex)

  for (const stage of stagesToDelete) {
    const stageFile = path.join(taskDir, `${stage}.md`)
    if (fs.existsSync(stageFile)) {
      fs.unlinkSync(stageFile)
      console.log(`Deleted: ${stage}.md`)
    }
  }

  // Update context
  writeAgentContext(taskDir)

  // Run impl pipeline (it will skip completed stages and re-run from the right point)
  await runImplPipeline(input, status)

  console.log('\n✅ Rerun complete!')
}

async function showStatus(input: OrchestratorInput): Promise<void> {
  const status = readStatus(input.taskId)

  if (!status) {
    console.log(`No status found for task: ${input.taskId}`)
    console.log('The pipeline may not have run yet, or status.json was deleted.')
    return
  }

  console.log(`Status for ${input.taskId}:`)
  console.log(JSON.stringify(status, null, 2))

  if (input.issueNumber) {
    postComment(input.issueNumber, formatStatusComment(input, status))
  }
}

// ============================================================================
// Agent Execution
// ============================================================================

function runAgentWithFileWatch(
  input: OrchestratorInput,
  stage: string,
  outputFile: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<{ succeeded: boolean; timedOut: boolean; retries: number }> {
  return new Promise((resolve) => {
    const cmd = `opencode github run --agent ${stage} "Execute ${stage} for ${input.taskId}. Read context from .tasks/${input.taskId}/.context.md"`

    const retries = 0 // TODO: Implement retry logic with increment on failure

    const attempt = (): void => {
      console.log(`  Attempt ${retries + 1}/${MAX_RETRIES + 1}`)

      const child: ChildProcess = spawn('sh', ['-c', cmd], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: { ...process.env }, // Includes OPENCODE_GITHUB_TOKEN
      })

      let resolved = false
      let settling = false
      let pollTimer: NodeJS.Timeout | null = null
      let timeoutTimer: NodeJS.Timeout | null = null

      const finish = (result: { succeeded: boolean; timedOut: boolean }) => {
        if (resolved) return
        resolved = true

        if (pollTimer) clearInterval(pollTimer)
        if (timeoutTimer) clearTimeout(timeoutTimer)

        // Kill process if still running
        if (!child.killed) {
          child.kill('SIGTERM')
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL')
          }, 5000)
        }

        resolve({ ...result, retries })
      }

      // Poll for output file
      const expectedBase = path.basename(outputFile, '.md')
      const taskDirForPoll = path.dirname(outputFile)

      pollTimer = setInterval(() => {
        if (settling) return

        try {
          let detectedFile = outputFile

          // Check exact match first
          if (!fs.existsSync(outputFile)) {
            // Check for prefix match (timestamped variant)
            const files = fs.readdirSync(taskDirForPoll)
            const prefixMatch = files.find(
              (f) => f.startsWith(expectedBase + '-') && f.endsWith('.md'),
            )
            if (prefixMatch) {
              detectedFile = path.join(taskDirForPoll, prefixMatch)
            } else {
              return
            }
          }

          const stat = fs.statSync(detectedFile)
          if (stat.size > 10) {
            settling = true

            // Rename if timestamped
            if (detectedFile !== outputFile) {
              console.log(
                `  📄 Output: ${path.basename(detectedFile)} → ${path.basename(outputFile)}`,
              )
              fs.renameSync(detectedFile, outputFile)
            }

            setTimeout(() => finish({ succeeded: true, timedOut: false }), FILE_SETTLE_DELAY)
          }
        } catch {
          // Ignore stat errors
        }
      }, FILE_POLL_INTERVAL)

      // Timeout
      timeoutTimer = setTimeout(() => {
        finish({ succeeded: false, timedOut: true })
      }, timeout)

      // Process exit
      child.on('exit', (code) => {
        if (!resolved) {
          // Success if file was created, otherwise check exit code
          if (fs.existsSync(outputFile)) {
            finish({ succeeded: true, timedOut: false })
          } else {
            finish({ succeeded: code === 0, timedOut: false })
          }
        }
      })
    }

    // Start first attempt
    attempt()
  })
}

// ============================================================================
// Execute
// ============================================================================

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
