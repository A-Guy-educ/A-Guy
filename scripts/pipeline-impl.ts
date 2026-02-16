#!/usr/bin/env ts-node
// pipeline-impl.ts - Runs plan through PR (Phase 2)
// Usage: pnpm pipeline:impl <task-id>
// Reads task.json to determine which pipeline to run.

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { preflight } from './preflight'
import {
  writeAgentContext,
  readTask,
  stageOutputFile,
  SPEC_EXECUTE_VERIFY_STAGES,
} from './pipeline-utils'

const taskId = process.argv[2]

if (!taskId) {
  console.log('Usage: pnpm pipeline:impl <task-id>')
  console.log('Example: pnpm pipeline:impl 260214-version-footer')
  process.exit(1)
}

const projectDir = process.cwd()
const taskDir = path.join(projectDir, '.tasks', taskId)

// Quick Win #1: Pre-flight validation
preflight()

// Read task definition to determine pipeline
const taskDef = readTask(taskDir)

if (!taskDef) {
  console.error(`Error: ${taskDir}/task.json not found`)
  console.log('Run "pnpm pipeline:spec <task-id>" first.')
  process.exit(1)
}

// Route based on task definition
if (taskDef.pipeline === 'spec_only') {
  console.log('')
  console.log('========================================')
  console.log(`Pipeline: spec_only (task_type: ${taskDef.task_type})`)
  console.log('')
  console.log('This task was classified as spec-only.')
  console.log('No implementation stages will run.')
  console.log('')
  console.log('Artifacts created during pipeline:spec:')
  console.log(`  • ${taskDir}/task.json`)
  console.log(`  • ${taskDir}/spec.md`)
  console.log(`  • ${taskDir}/questions.md`)
  console.log('========================================')
  console.log('')
  process.exit(0)
}

// Check that clarification exists (only needed for spec_execute_verify)
if (!fs.existsSync(path.join(taskDir, 'clarified.md'))) {
  console.error(`Error: ${taskDir}/clarified.md not found`)
  console.log('Run "pnpm pipeline:spec <task-id>" first to generate questions.')
  process.exit(1)
}

// spec_execute_verify pipeline
const stages = SPEC_EXECUTE_VERIFY_STAGES

// Model per stage: smarter models for planning/analysis, fast for execution
// Source of truth: opencode.json
const stageModels: Record<string, string> = {
  plan: 'anthropic/claude-opus-4-6', // Deep architecture planning
  build: 'minimax/MiniMax-M2.1', // Fast implementation
  test: 'minimax/MiniMax-M2.1', // Fast test writing
  verify: 'minimax/MiniMax-M2.1', // Fast verification
  auditor: 'anthropic/claude-opus-4-6', // Deep analysis
  pr: 'minimax/MiniMax-M2.1', // Fast PR creation
}

console.log(`=== Pipeline Impl: ${taskId} ===`)
console.log(`Pipeline: ${taskDef.pipeline} (${taskDef.task_type}, risk: ${taskDef.risk_level})`)
console.log('')

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

// Quick Win #2: Extract failure summary from verify.md
interface VerifySummary {
  typeScriptErrors: number
  testFailures: number
  lintErrors: number
  errorSamples: string[]
}

function extractVerifySummary(content: string): VerifySummary {
  const summary: VerifySummary = {
    typeScriptErrors: 0,
    testFailures: 0,
    lintErrors: 0,
    errorSamples: [],
  }

  // Extract TypeScript errors
  const tsMatch = content.match(/TypeScript.*?(\d+)\s+error/i)
  if (tsMatch) {
    summary.typeScriptErrors = parseInt(tsMatch[1])
  }

  // Extract test failures
  const testMatch = content.match(/Tests?.*?(\d+)\s+fail/i)
  if (testMatch) {
    summary.testFailures = parseInt(testMatch[1])
  }

  // Extract lint errors
  const lintMatch = content.match(/Lint.*?(\d+)\s+error/i)
  if (lintMatch) {
    summary.lintErrors = parseInt(lintMatch[1])
  }

  // Extract error samples (lines starting with - or • or containing "error:")
  const lines = content.split('\n')
  for (const line of lines) {
    if (
      (line.trim().startsWith('-') || line.trim().startsWith('•')) &&
      (line.includes('error') || line.includes('Error') || line.includes('✗'))
    ) {
      const cleaned = line.trim().replace(/^[-•]\s*/, '')
      if (cleaned.length > 10 && summary.errorSamples.length < 5) {
        summary.errorSamples.push(cleaned)
      }
    }
  }

  return summary
}

// Quick Win #3: Better error context
function showStageErrorContext(stage: string): void {
  console.error(`\nCommon causes for ${stage} failure:`)

  if (stage === 'build') {
    console.error(`  • Agent didn't create build.md output file`)
    console.error(`  • Git operation failed (merge conflict, permissions)`)
    console.error(`  • TypeScript/lint errors in generated code`)
    console.error(`  • Import path issues`)
  } else if (stage === 'test') {
    console.error(`  • Test files not created in correct directory`)
    console.error(`  • Import errors in test code`)
    console.error(`  • Missing test dependencies`)
  } else if (stage === 'verify') {
    console.error(`  • TypeScript compilation errors`)
    console.error(`  • Linting failures`)
    console.error(`  • Test failures`)
    console.error(`  • See verify.md for details`)
  } else if (stage === 'plan') {
    console.error(`  • Context missing from .context.md`)
    console.error(`  • Insufficient clarification`)
  } else if (stage === 'pr') {
    console.error(`  • Branch not pushed to remote`)
    console.error(`  • GitHub CLI (gh) not configured`)
    console.error(`  • Missing PR permissions`)
  }

  console.error(`\n💡 Next steps:`)
  console.error(`  1. Check .tasks/${taskId}/${stage}.md for details (if exists)`)
  console.error(`  2. Review agent output above`)
  console.error(`  3. Fix issues and run: pnpm pipeline:rerun ${taskId} --feedback "<issue>"`)
  console.error(`  4. Or fix manually and run: pnpm pipeline:impl ${taskId}`)
}

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i]
  const outputFile = stageOutputFile(taskDir, stage)

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
  writeAgentContext(taskDir)

  // R4: try/catch around execSync
  try {
    const model = stageModels[stage] || 'minimax/MiniMax-M2.1'
    execSync(
      `pnpm ocode run --agent ${stage} -m ${model} "Execute ${stage} for ${taskId}. Read context from .tasks/${taskId}/.context.md"`,
      {
        cwd: projectDir,
        stdio: 'inherit',
      },
    )

    // R9: Validate that agent created output file
    if (!fs.existsSync(outputFile)) {
      console.error(`\n❌ Stage "${stage}" completed but did not create ${outputFile}`)
      console.error(
        `The ${stage} agent MUST create an output file as specified in .opencode/agents/${stage}.md`,
      )
      console.error('Check agent definition and ensure it writes the required output.')
      process.exit(1)
    }
  } catch {
    console.error(`\n❌ Stage "${stage}" failed for ${taskId}`)
    showStageErrorContext(stage)
    process.exit(1)
  }

  // R1: Check verify content for FAIL
  if (stage === 'verify' && fs.existsSync(outputFile)) {
    const content = fs.readFileSync(outputFile, 'utf-8')
    if (/FAIL/i.test(content)) {
      console.error(`\n❌ Verification FAILED for ${taskId}`)

      // Quick Win #2: Show failure summary
      const summary = extractVerifySummary(content)

      if (summary.typeScriptErrors > 0 || summary.testFailures > 0 || summary.lintErrors > 0) {
        console.error('\n📋 Failure Summary:')

        if (summary.typeScriptErrors > 0) {
          console.error(`  TypeScript: ${summary.typeScriptErrors} error(s)`)
        }
        if (summary.testFailures > 0) {
          console.error(`  Tests: ${summary.testFailures} failure(s)`)
        }
        if (summary.lintErrors > 0) {
          console.error(`  Lint: ${summary.lintErrors} error(s)`)
        }

        if (summary.errorSamples.length > 0) {
          console.error('\n  Sample errors:')
          summary.errorSamples.forEach((err) => console.error(`    - ${err}`))
        }
      }

      console.error(`\n📄 Full report: ${outputFile}`)
      console.error('\n💡 Next steps:')
      console.error(`  1. Review errors above`)
      console.error(
        `  2. Fix and run: pnpm pipeline:rerun ${taskId} --feedback "<fix description>"`,
      )
      console.error(`  3. Or fix manually and run: pnpm pipeline:impl ${taskId}`)

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
