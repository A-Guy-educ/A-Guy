#!/usr/bin/env ts-node
// pipeline-spec.ts - Runs taskify → spec → clarify (Phase 1)
// Usage: pnpm pipeline:spec <task-id> [--file <path>]

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { preflight } from './preflight'
import { writeAgentContext, readTask, stageOutputFile, writeDryRunOutput } from './pipeline-utils'

const args = process.argv.slice(2)
let taskId: string | undefined
let filePath: string | undefined
let dryRun = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    filePath = args[i + 1]
    i++ // skip value
  } else if (args[i] === '--dry-run') {
    dryRun = true
  } else if (!args[i].startsWith('--')) {
    taskId = args[i]
  }
}

// Auto-generate task ID from filename when --file is used without explicit task ID
if (!taskId && filePath) {
  const now = new Date()
  const datePrefix = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const stem = path.basename(filePath, path.extname(filePath))
  taskId = `${datePrefix}-${stem}`
}

if (!taskId) {
  console.log('Usage: pnpm pipeline:spec [--file <path>] [--dry-run] [<task-id>]')
  console.log('Example: pnpm pipeline:spec 260214-version-footer')
  console.log('         pnpm pipeline:spec --file requirements/fix-dropdown.md')
  console.log('         pnpm pipeline:spec --file req.md 260216-custom-id')
  console.log('         pnpm pipeline:spec --file req.md --dry-run')
  process.exit(1)
}

const projectDir = process.cwd()
const taskDir = path.join(projectDir, '.tasks', taskId)

// Quick Win #1: Pre-flight validation
preflight()

// R12: Ensure task directory exists
if (!fs.existsSync(taskDir)) {
  fs.mkdirSync(taskDir, { recursive: true })
  console.log(`Created task directory: ${taskDir}`)
}

// --file flag: read file content and write it as task.md
if (filePath) {
  const resolvedFile = path.resolve(filePath)
  if (!fs.existsSync(resolvedFile)) {
    console.error(`Error: File not found: ${resolvedFile}`)
    process.exit(1)
  }
  const content = fs.readFileSync(resolvedFile, 'utf-8').trim()
  if (!content) {
    console.error(`Error: File is empty: ${resolvedFile}`)
    process.exit(1)
  }
  const taskMdPath = path.join(taskDir, 'task.md')
  fs.writeFileSync(taskMdPath, `# Task\n\n${content}\n`)
  console.log(`Created task.md from ${resolvedFile}`)
}

// Validate task.md exists (taskify needs it)
if (!fs.existsSync(path.join(taskDir, 'task.md'))) {
  console.error(`Error: ${taskDir}/task.md not found`)
  console.log(
    'Create a task.md file with the task description, or use --file <path> to provide one.',
  )
  process.exit(1)
}

// Phase 1 stages: taskify → spec → clarify
const stages = ['taskify', 'spec', 'clarify']

console.log(`=== Pipeline Spec: ${taskId}${dryRun ? ' (DRY-RUN)' : ''} ===`)

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i]
  const outputFile = stageOutputFile(taskDir, stage)

  // Skip if output already exists
  if (fs.existsSync(outputFile)) {
    console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)

    continue
  }

  console.log(`[${i + 1}/${stages.length}] Running ${stage} agent...${dryRun ? ' (dry-run)' : ''}`)

  // R8: Write context file before invoking agent
  writeAgentContext(taskDir)

  if (dryRun) {
    writeDryRunOutput(taskDir, stage, taskId)
  } else {
    // R4: try/catch around execSync
    try {
      execSync(
        `pnpm ocode run --agent ${stage} "Execute ${stage} for ${taskId}. Read context from .tasks/${taskId}/.context.md"`,
        {
          cwd: projectDir,
          stdio: 'inherit',
        },
      )
    } catch {
      console.error(`\n❌ Stage "${stage}" failed for ${taskId}`)
      console.error('Fix the issue and re-run. Completed stages will be skipped.')
      process.exit(1)
    }
  }

  // Validate taskify output
  if (stage === 'taskify') {
    // readTask validates schema and exits on error
    const taskDef = readTask(taskDir)

    if (!taskDef) {
      console.error(`\n❌ Taskify agent did not create ${outputFile}`)
      console.error('Check agent definition and ensure it writes task.json.')
      process.exit(1)
    }

    console.log(`  task_type: ${taskDef.task_type}`)
    console.log(`  pipeline:  ${taskDef.pipeline}`)
    console.log(`  risk:      ${taskDef.risk_level}`)
    console.log(`  confidence: ${taskDef.confidence}`)
    console.log(`  domain:    ${taskDef.primary_domain}`)
  }

  console.log(`✓ ${stage} complete`)
}

// Create clarified.md if it doesn't exist (pipeline:impl requires it)
const clarifiedPath = path.join(taskDir, 'clarified.md')
if (!fs.existsSync(clarifiedPath)) {
  fs.writeFileSync(clarifiedPath, '# Clarified\n\nUse recommended answers.\n')
}

// Show next steps based on pipeline type
const finalTaskDef = readTask(taskDir)
const pipeline = finalTaskDef?.pipeline ?? 'spec_execute_verify'

console.log('')
console.log('========================================')

if (pipeline === 'spec_only') {
  console.log(`Pipeline: spec_only (no implementation stages)`)
  console.log('')
  console.log('Artifacts created:')
  console.log(`  • ${taskDir}/task.json`)
  console.log(`  • ${taskDir}/spec.md`)
  console.log(`  • ${taskDir}/questions.md`)
  console.log('')
  console.log('If clarification is needed, write answers to:')
  console.log(`   ${taskDir}/clarified.md`)
} else {
  console.log('STOP: Clarification required')
  console.log('')
  console.log('1. Read questions:')
  console.log(`   ${taskDir}/questions.md`)
  console.log('')
  console.log('2. Write answers:')
  console.log(`   ${taskDir}/clarified.md`)
  console.log('')
  console.log(`When ready, run: pnpm pipeline:impl ${taskId}`)
}

console.log('========================================')
console.log('')
