#!/usr/bin/env ts-node
// pipeline-impl.ts - Runs plan through PR (Phase 2)
// Usage: pnpm pipeline:impl <task-id>

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const taskId = process.argv[2]

if (!taskId) {
  console.log('Usage: pnpm pipeline:impl <task-id>')
  console.log('Example: pnpm pipeline:impl 260214-version-footer')
  process.exit(1)
}

const projectDir = process.cwd()
const taskDir = path.join(projectDir, '.tasks', taskId)

// R3: Check ocode CLI availability
try {
  execSync('which ocode', { stdio: 'pipe' })
} catch {
  console.error('Error: ocode CLI not found.')
  console.error('Install: curl -fsSL https://opencode.ai/install | bash')
  process.exit(1)
}

// Check that clarification exists
if (!fs.existsSync(path.join(taskDir, 'clarified.md'))) {
  console.error(`Error: ${taskDir}/clarified.md not found`)
  console.log('Run "pnpm pipeline:spec <task-id>" first to generate questions.')
  process.exit(1)
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

// Commit task files to preserve pipeline artifacts
function commitTaskFiles(): void {
  console.log(`[commit] Adding task files...`)
  try {
    execSync(`git add ${taskDir}`, { cwd: projectDir, stdio: 'inherit' })
    execSync(`git commit --no-gpg-sign -m "docs: commit ${taskId} task files"`, {
      cwd: projectDir,
      stdio: 'inherit',
    })
    console.log(`[commit] Task files committed`)
  } catch {
    // Ignore if nothing to commit or other git errors
    console.log(`[commit] No changes to commit (or git error)`)
  }
}

// Always run: plan → build → test → verify → auditor → pr
const stages = ['plan', 'build', 'test', 'verify', 'auditor', 'pr']

// Model per stage: smarter models for planning/analysis, fast for execution
const stageModels: Record<string, string> = {
  plan: 'openai/gpt-5.2',      // Good for architecture planning
  build: 'minimax/MiniMax-M2.1', // Fast for implementation
  test: 'minimax/MiniMax-M2.1',  // Fast for test writing
  verify: 'minimax/MiniMax-M2.1', // Fast for verification
  auditor: 'anthropic/claude-opus-4-6', // Good for analysis
  pr: 'minimax/MiniMax-M2.1',   // Fast for PR creation
}

console.log(`=== Pipeline Impl: ${taskId} ===`)

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i]
  const outputFile = path.join(taskDir, `${stage}.md`)

  // R2: Delete stale verify.md before re-running verify
  if (stage === 'verify' && fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile)
    console.log(`[${i + 1}/${stages.length}] Deleted stale verify.md for re-verification`)
  }

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
    const model = stageModels[stage] || 'minimax/MiniMax-M2.1'
    execSync(
      `ocode run --agent ${stage} -m ${model} "Execute ${stage} for ${taskId}. Read context from .tasks/${taskId}/.context.md"`,
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

  // R1: Check verify content for FAIL
  if (stage === 'verify' && fs.existsSync(outputFile)) {
    const content = fs.readFileSync(outputFile, 'utf-8')
    if (/FAIL/i.test(content)) {
      console.error(`\n❌ Verification FAILED for ${taskId}`)
      console.error(`See: ${outputFile}`)
      console.error('Fix issues and re-run. The verify stage will re-run automatically.')
      process.exit(1)
    }
    // Commit task files after verify passes
    commitTaskFiles()
  }

  console.log(`✓ ${stage} complete`)
}

console.log('')
console.log('========================================')
console.log(`✓ Pipeline complete: ${taskId}`)
console.log('========================================')
console.log('')
