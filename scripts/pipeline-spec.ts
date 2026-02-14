#!/usr/bin/env ts-node
// pipeline-spec.ts - Runs spec + clarify (Phase 1)
// Usage: pnpm pipeline:spec <task-id>

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { preflight } from './preflight'

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

// R8: Write agent context file
function writeAgentContext(): void {
  const contextFiles = [
    'task.md',
    'spec.md',
    'clarified.md',
    'plan.md',
    'build.md',
    'test.md',
    'verify.md',
  ]
  const parts: string[] = []
  for (const file of contextFiles) {
    const p = path.join(taskDir, file)
    if (fs.existsSync(p)) {
      parts.push(`# ${file}\n\n${fs.readFileSync(p, 'utf-8')}`)
    }
  }
  fs.writeFileSync(path.join(taskDir, '.context.md'), parts.join('\n\n---\n\n'))
}

// Always run: spec → clarify
const stages = ['spec', 'clarify']

console.log(`=== Pipeline Spec: ${taskId} ===`)

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i]

  // clarify agent writes questions.md, not clarify.md
  const outputFileName = stage === 'clarify' ? 'questions.md' : `${stage}.md`
  const outputFile = path.join(taskDir, outputFileName)

  // Skip if output already exists
  if (fs.existsSync(outputFile)) {
    console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
    continue
  }

  console.log(`[${i + 1}/${stages.length}] Running ${stage} agent...`)

  // R8: Write context file before invoking agent
  writeAgentContext()

  // R4: try/catch around execSync
  try {
    execSync(
      `ocode run --agent ${stage} "Execute ${stage} for ${taskId}. Read context from .tasks/${taskId}/.context.md"`,
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

  console.log(`✓ ${stage} complete`)
}

console.log('')
console.log('========================================')
console.log('STOP: Clarification required')
console.log('')
console.log('1. Read questions:')
console.log(`   ${taskDir}/questions.md`)
console.log('')
console.log('2. Write answers:')
console.log(`   ${taskDir}/clarified.md`)
console.log('')
console.log('When ready, run: pnpm pipeline:impl <task-id>')
console.log('========================================')
console.log('')
