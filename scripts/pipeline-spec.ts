#!/usr/bin/env ts-node
// pipeline-spec.ts - Runs taskify → spec → clarify (Phase 1)
// Usage: pnpm pipeline:spec <task-id>

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { preflight } from './preflight'
import { writeAgentContext, readTask, stageOutputFile } from './pipeline-utils'

const taskId = process.argv[2]

if (!taskId) {
  console.log('Usage: pnpm pipeline:spec <task-id>')
  console.log('Example: pnpm pipeline:spec 260214-version-footer')
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

// Validate task.md exists (taskify needs it)
if (!fs.existsSync(path.join(taskDir, 'task.md'))) {
  console.error(`Error: ${taskDir}/task.md not found`)
  console.log('Create a task.md file with the task description before running the pipeline.')
  process.exit(1)
}

// Phase 1 stages: taskify → spec → clarify
const stages = ['taskify', 'spec', 'clarify']

console.log(`=== Pipeline Spec: ${taskId} ===`)

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i]
  const outputFile = stageOutputFile(taskDir, stage)

  // Skip if output already exists
  if (fs.existsSync(outputFile)) {
    console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)

    // Still validate task definition even when skipping
    if (stage === 'taskify') {
      const taskDef = readTask(taskDir)
      if (taskDef && taskDef.missing_inputs.length > 0) {
        showMissingInputs(taskDef.missing_inputs)
        process.exit(1)
      }
    }

    continue
  }

  console.log(`[${i + 1}/${stages.length}] Running ${stage} agent...`)

  // R8: Write context file before invoking agent
  writeAgentContext(taskDir)

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

    // Stop-on-missing-inputs rule
    if (taskDef.missing_inputs.length > 0) {
      showMissingInputs(taskDef.missing_inputs)
      process.exit(1)
    }
  }

  console.log(`✓ ${stage} complete`)
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

function showMissingInputs(inputs: Array<{ field: string; question: string }>): void {
  console.error('')
  console.error('========================================')
  console.error('STOP: Missing required inputs')
  console.error('')
  console.error('The taskify agent identified missing information:')
  console.error('')
  inputs.forEach((item, idx) => {
    console.error(`  ${idx + 1}. [${item.field}] ${item.question}`)
  })
  console.error('')
  console.error('Add the missing information to:')
  console.error(`   ${taskDir}/task.md`)
  console.error('')
  console.error('Then delete task.json and re-run:')
  console.error(`   rm ${taskDir}/task.json`)
  console.error(`   pnpm pipeline:spec ${taskId}`)
  console.error('========================================')
  console.error('')
}
