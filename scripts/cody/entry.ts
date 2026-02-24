/**
 * @fileType script
 * @domain cody
 * @pattern entry-point
 * @ai-summary New CLI entry point for Cody pipeline state machine
 */

import * as fs from 'fs'
import * as path from 'path'

import { parseCliArgs, validateAuth, ensureTaskDir, getLastFailedStage } from './cody-utils'
import { preflight } from './preflight'
import { createRunner } from './runner-backend'
import { setGlobalContext } from './logger'
import { handleClarification } from './clarify-workflow'
import { commitPipelineFiles } from './git-utils'
import { stageOutputFile, readTask } from './pipeline-utils'

import type { PipelineContext } from './engine/types'
import { runPipeline } from './engine/state-machine'
import { resolvePipelineForMode, createRebuildCallback } from './engine/pipeline-resolver'
import { stateToV1 } from './engine/status'
import { PipelinePausedError } from './engine/types'
import { ensureTaskMarkerComment, postComment } from './github-api'
import { formatStatusComment } from './cody-utils'

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse CLI args
  const input = parseCliArgs(process.argv.slice(2))

  // Set global logging context
  setGlobalContext({ taskId: input.taskId, runId: input.runId })

  // G2: Signal handlers with null guard
  const cleanupOnSignal = async (signal: string) => {
    console.error(`\n⚠ Received ${signal} — CI runner shutting down`)
    try {
      const { loadState, completeState, writeState } = await import('./engine/status')
      const state = loadState(input.taskId)
      if (state) {
        const failedState = completeState(state, 'failed')
        writeState(input.taskId, failedState)
        console.error(`  Updated status.json to "failed" for task ${input.taskId}`)
      }
    } catch (err) {
      console.error(`  Failed to update status:`, err)
    }
    process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
  }

  process.on('SIGTERM', () => cleanupOnSignal('SIGTERM'))
  process.on('SIGINT', () => cleanupOnSignal('SIGINT'))

  console.log(`Task: ${input.taskId}`)
  console.log(`Mode: ${input.mode}`)
  console.log(`Dry run: ${input.dryRun}`)
  console.log(`Local: ${input.local}`)
  if (input.issueNumber) console.log(`Issue: #${input.issueNumber}`)
  console.log('')

  // Run preflight checks in local mode
  if (input.local) {
    preflight()
  }

  // Validate GitHub App authentication (skip in local mode)
  if (!input.local) {
    validateAuth()
  }

  // Create runner backend
  const backend = createRunner(input.local)

  // Ensure task directory
  const taskDir = ensureTaskDir(input.taskId)

  // G3: Ensure task marker comment runs for ALL modes before the mode switch
  if (input.issueNumber) {
    ensureTaskMarkerComment(input.issueNumber, input.taskId, input.mode, input.runUrl)
  }

  // Pre-pipeline setup per mode
  const ctx: PipelineContext = {
    taskId: input.taskId,
    taskDir,
    input,
    taskDef: null,
    profile: 'standard',
    backend,
  }

  try {
    switch (input.mode) {
      case 'spec':
        await runSpecMode(ctx)
        break
      case 'impl':
        await runImplMode(ctx)
        break
      case 'full':
        await runFullMode(ctx)
        break
      case 'rerun':
        await runRerunMode(ctx)
        break
      case 'status':
        await runStatusMode(ctx)
        break
      default:
        throw new Error(`Unknown mode: ${input.mode}`)
    }
  } catch (error) {
    if (error instanceof PipelinePausedError) {
      // Pipeline paused - handled internally
      return
    }

    // G6: process.exit(1) on failure
    // Only update status if state exists (not if failure happened before initState)
    const { writeState, loadState: loadSt, completeState } = await import('./engine/status')
    const existingState = loadSt(input.taskId)
    if (existingState) {
      const failedState = completeState(existingState, 'failed')
      writeState(input.taskId, failedState)
    }

    console.error('\n❌ Cody failed:', error instanceof Error ? error.message : error)

    if (input.issueNumber) {
      postComment(
        input.issueNumber,
        `❌ Pipeline failed for \`${input.taskId}\`: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
    process.exit(1)
  }
}

/**
 * Spec mode setup
 */
async function runSpecMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  const taskMdPath = path.join(taskDir, 'task.md')

  // G8: --file flag has priority
  if (input.file) {
    const resolvedFile = path.resolve(input.file)
    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`File not found: ${resolvedFile}`)
    }
    const content = fs.readFileSync(resolvedFile, 'utf-8').trim()
    if (!content) {
      throw new Error(`File is empty: ${resolvedFile}`)
    }
    fs.writeFileSync(taskMdPath, `# Task\n\n${content}\n`)
    console.log(`Created task.md from ${resolvedFile}`)
  }

  // Create task.md from issue body if it doesn't exist
  if (!fs.existsSync(taskMdPath)) {
    if (input.issueNumber) {
      const { getIssue } = await import('./github-api')
      console.log('task.md not found, fetching issue body to create it...')
      const { body: issueBody, title: issueTitle } = getIssue(input.issueNumber)
      if (issueBody) {
        // G9: Issue title included via ## Issue Title section
        const titleSection = issueTitle ? `## Issue Title\n\n${issueTitle}\n` : ''
        fs.writeFileSync(taskMdPath, `# Task\n\n${titleSection}${issueBody}\n`)
        console.log(
          `Created task.md from issue #${input.issueNumber}${issueTitle ? ` (title: "${issueTitle}")` : ''}`,
        )
      } else {
        throw new Error(
          `task.md not found in .tasks/${input.taskId}/ and issue #${input.issueNumber} has no body. Create it first.`,
        )
      }
    } else {
      throw new Error(`task.md not found in .tasks/${input.taskId}/. Create it first.`)
    }
  }

  // Run spec pipeline
  const pipeline = resolvePipelineForMode('spec', 'standard', input.clarify ?? false, ctx)
  await runPipeline(ctx, pipeline)

  // G17: Post-spec clarification logic
  if (input.clarify) {
    const clarifyResult = handleClarification(input, taskDir)
    if (clarifyResult === 'waiting') {
      console.log('\n⚠️ Clarify stage has questions that need answering')
      const questionsPath = path.join(taskDir, 'questions.md')
      if (input.issueNumber) {
        const questionsContent = fs.readFileSync(questionsPath, 'utf-8')
        const preview = questionsContent.slice(0, 1500)
        postComment(
          input.issueNumber,
          `🔄 Cody stopped at clarify stage - questions need answering:\n\n${preview}\n\nPlease answer these questions and call \`/cody\` again to proceed with implementation.`,
        )
      }
      // Commit task files and pause
      commitPipelineFiles({
        taskDir,
        taskId: input.taskId,
        message: `ci(cody): Save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
        ensureBranch: true,
        cleanDirtyState: true,
        stagingStrategy: 'task-only',
        push: true,
        isCI: !input.local,
        dryRun: input.dryRun,
      })
      throw new PipelinePausedError(`clarify stage: awaiting answers for ${input.taskId}`)
    }
  }

  // Commit spec task files
  commitPipelineFiles({
    taskDir,
    taskId: input.taskId,
    message: `ci(cody): Save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
    ensureBranch: true,
    cleanDirtyState: true,
    stagingStrategy: 'task-only',
    push: true,
    isCI: !input.local,
    dryRun: input.dryRun,
  })

  console.log('\n✅ Cody SPEC pipeline complete')
}

/**
 * Impl mode setup
 */
async function runImplMode(ctx: PipelineContext): Promise<void> {
  const { taskDir } = ctx

  // Validate clarified.md exists
  const clarifiedPath = path.join(taskDir, 'clarified.md')
  if (!fs.existsSync(clarifiedPath)) {
    throw new Error(`clarified.md not found. Run spec pipeline first or create it.`)
  }

  // Get task definition
  let taskDef
  try {
    taskDef = readTask(taskDir)
    ctx.taskDef = taskDef
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Failed to read task definition: ${msg}`)
    throw new Error(`Invalid task.json: ${msg}`)
  }
  if (!taskDef) {
    throw new Error(`task.json not found. Run spec pipeline first.`)
  }

  // Check spec_only pipeline
  if (taskDef.pipeline === 'spec_only') {
    console.log('Task pipeline is spec_only — skipping implementation stages.')
    return
  }

  // Resolve profile
  const { resolvePipelineProfile } = await import('./pipeline-utils')
  ctx.profile = resolvePipelineProfile(taskDef)
  console.log(`ℹ️ Pipeline profile: ${ctx.profile}`)

  // Run impl pipeline (pass rebuild callback for two-phase construction)
  const pipeline = resolvePipelineForMode('impl', ctx.profile, false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  await runPipeline(ctx, pipeline, undefined, rebuild)

  console.log('\n✅ Cody IMPLEMENTATION pipeline complete')
}

/**
 * Full mode setup
 */
async function runFullMode(ctx: PipelineContext): Promise<void> {
  console.log('Running FULL Cody pipeline (spec + impl)...\n')

  // Run full pipeline with rebuild callback for two-phase construction
  // This uses buildPipeline('full') which includes both spec and impl stages
  const pipeline = resolvePipelineForMode('full', 'standard', ctx.input.clarify ?? false, ctx)
  const rebuild = createRebuildCallback('full', ctx.input.clarify ?? false)
  await runPipeline(ctx, pipeline, undefined, rebuild)

  console.log('\n✅ Full Cody pipeline complete!')
}

/**
 * Rerun mode setup
 */
async function runRerunMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  console.log('Running Cody RERUN pipeline...\n')

  // G33: Fallback to full if spec.md missing
  const specPath = path.join(taskDir, 'spec.md')
  if (!fs.existsSync(specPath)) {
    console.log('No spec.md found — falling back to full pipeline')
    input.mode = 'full'
    await runFullMode(ctx)
    return
  }

  // Determine fromStage
  if (!input.fromStage) {
    input.fromStage = getLastFailedStage(input.taskId) || 'build'
  }

  // Default feedback
  if (!input.feedback) {
    input.feedback = 'Rerun requested via /cody rerun'
  }

  // G37: Write feedback file
  const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
  fs.writeFileSync(
    feedbackFile,
    `# Rerun Feedback - ${new Date().toISOString()}\n\n## Issues Found\n\n${input.feedback}\n`,
  )

  console.log(`Feedback: ${input.feedback}`)
  console.log(`From stage: ${input.fromStage}\n`)

  // G37: Delete output files from rerun point onwards
  const taskDef = readTask(taskDir)
  ctx.taskDef = taskDef
  if (taskDef) {
    const { resolvePipelineProfile } = await import('./pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
  }

  // For rerun, we need to delete the files manually since the engine won't do it
  // The status.ts resetFromStage handles this but we need to call it
  const { loadState, resetFromStage, writeState } = await import('./engine/status')
  const state = loadState(input.taskId)
  if (state) {
    // Get stages to delete from
    const stageOrder = [
      'architect',
      'plan-gap',
      'build',
      'commit',
      'verify',
      'auditor',
      'apply-audit',
      'pr',
    ]
    const fromIndex = stageOrder.indexOf(input.fromStage || 'build')
    if (fromIndex >= 0) {
      const stagesToDelete = stageOrder.slice(fromIndex)
      for (const stage of stagesToDelete) {
        const outputFile = stageOutputFile(taskDir, stage)
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile)
          console.log(`Deleted: ${stage}.md`)
        }
      }
    }

    // Reset stages in status
    const newState = resetFromStage(state, input.fromStage || 'build', stageOrder, taskDir)
    writeState(input.taskId, newState)
  }

  // Run impl pipeline
  const pipeline = resolvePipelineForMode('rerun', ctx.profile, false, ctx)
  await runPipeline(ctx, pipeline)

  console.log('\n✅ Rerun complete!')
}

/**
 * Status mode
 */
async function runStatusMode(ctx: PipelineContext): Promise<void> {
  const { input } = ctx
  const { loadState } = await import('./engine/status')

  const state = loadState(input.taskId)

  if (!state) {
    console.log(`No status found for task: ${input.taskId}`)
    console.log(`The Cody may not have run yet, or status.json was deleted.`)
    return
  }

  console.log(`Status for ${input.taskId}:`)
  console.log(JSON.stringify(state, null, 2))

  if (input.issueNumber) {
    const v1Status = stateToV1(state)
    postComment(input.issueNumber, formatStatusComment(input, v1Status))
  }
}

// Run main
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
