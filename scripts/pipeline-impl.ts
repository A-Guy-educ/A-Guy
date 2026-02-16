#!/usr/bin/env ts-node
// pipeline-impl.ts - Runs plan through PR (Phase 2)
// Usage: pnpm pipeline:impl <task-id>
// Reads task.json to determine which pipeline to run.

import { execSync, spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  readTask,
  SPEC_EXECUTE_VERIFY_STAGES,
  stageOutputFile,
  writeAgentContext,
  writeDryRunOutput,
} from './pipeline-utils'
import { preflight } from './preflight'

const implArgs = process.argv.slice(2)
let taskId: string | undefined
let dryRun = false

for (const arg of implArgs) {
  if (arg === '--dry-run') {
    dryRun = true
  } else if (!arg.startsWith('--')) {
    taskId = arg
  }
}

if (!taskId) {
  console.log('Usage: pnpm pipeline:impl [--dry-run] <task-id>')
  console.log('Example: pnpm pipeline:impl 260214-version-footer')
  console.log('         pnpm pipeline:impl --dry-run 260214-version-footer')
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
// Skip auditor on reruns — it's a process analysis stage, not needed when fixing code
const isRerun = fs.existsSync(path.join(taskDir, 'rerun-feedback.md'))
const SKIP_ON_RERUN = ['auditor']
const stages = isRerun
  ? SPEC_EXECUTE_VERIFY_STAGES.filter((s) => !SKIP_ON_RERUN.includes(s))
  : SPEC_EXECUTE_VERIFY_STAGES

// Stage timeouts (ms) — kills agent process if exceeded
const STAGE_TIMEOUTS: Record<string, number> = {
  architect: 5 * 60_000,
  build: 30 * 60_000,
  test: 10 * 60_000,
  verify: 5 * 60_000,
  auditor: 5 * 60_000,
  pr: 5 * 60_000,
}
const DEFAULT_TIMEOUT = 10 * 60_000
const MAX_RETRIES = 2

console.log(`=== Pipeline Impl: ${taskId}${dryRun ? ' (DRY-RUN)' : ''} ===`)
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
  } else if (stage === 'architect') {
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

// Run agent with file watcher — spawns ocode process and kills it once output file appears.
// This works around the OpenCode post-Write stalling bug where agents hang after writing output.
const FILE_POLL_INTERVAL = 3_000 // check every 3 seconds
const FILE_SETTLE_DELAY = 2_000 // wait 2s after file appears to ensure write is complete

function runAgentWithFileWatch(
  stage: string,
  outputFile: string,
  _taskId: string,
  timeout: number,
): Promise<{ succeeded: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const cmd = `pnpm ocode run --agent ${stage} "Execute ${stage} for ${_taskId}. Read context from .tasks/${_taskId}/.context.md"`
    const child: ChildProcess = spawn('sh', ['-c', cmd], {
      cwd: projectDir,
      stdio: 'inherit',
    })

    let resolved = false
    const finish = (result: { succeeded: boolean; timedOut: boolean }) => {
      if (resolved) return
      resolved = true
      clearInterval(pollTimer)
      clearTimeout(timeoutTimer)
      // Kill the process tree if still running
      if (!child.killed) {
        child.kill('SIGTERM')
        // Force kill after 5s if SIGTERM doesn't work
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL')
        }, 5_000)
      }
      resolve(result)
    }

    // Poll for output file (exact match or prefix match like verify-YYYYMMDD.md)
    const expectedBase = path.basename(outputFile, '.md') // e.g. "verify"
    const taskDirForPoll = path.dirname(outputFile)
    let settling = false

    const pollTimer = setInterval(() => {
      if (settling) return
      try {
        let detectedFile = outputFile

        // Check exact match first
        if (!fs.existsSync(outputFile)) {
          // Check for prefix match (agent wrote timestamped variant)
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
          // Rename prefix match to expected name
          if (detectedFile !== outputFile) {
            console.log(
              `\n📄 Output file detected: ${path.basename(detectedFile)} (renaming to ${path.basename(outputFile)})`,
            )
            fs.renameSync(detectedFile, outputFile)
          } else {
            console.log(
              `\n📄 Output file detected: ${path.basename(outputFile)} (${stat.size} bytes)`,
            )
          }
          console.log(`   Waiting ${FILE_SETTLE_DELAY / 1000}s for write to settle...`)
          setTimeout(() => {
            console.log(`   Stopping agent (output file ready)`)
            finish({ succeeded: true, timedOut: false })
          }, FILE_SETTLE_DELAY)
        }
      } catch {
        // Ignore stat errors
      }
    }, FILE_POLL_INTERVAL)

    // Overall timeout
    const timeoutTimer = setTimeout(() => {
      finish({ succeeded: false, timedOut: true })
    }, timeout)

    // Process exited on its own (normal or error)
    child.on('exit', (code) => {
      if (!resolved) {
        finish({ succeeded: code === 0, timedOut: false })
      }
    })
  })
}

// Branch setup: ensure we're on a feature branch before build
function ensureFeatureBranch(): void {
  const currentBranch = execSync('git branch --show-current', {
    cwd: projectDir,
    encoding: 'utf-8',
  }).trim()

  if (currentBranch !== 'dev' && currentBranch !== 'main') {
    console.log(`[branch] Already on feature branch: ${currentBranch}`)
    return
  }

  // Determine branch prefix from task type
  const prefixMap: Record<string, string> = {
    implement_feature: 'feat',
    fix_bug: 'fix',
    refactor: 'refactor',
    docs: 'docs',
    ops: 'chore',
  }
  const prefix = prefixMap[taskDef!.task_type] || 'feat'
  const branchName = `${prefix}/${taskId}`

  console.log(`[branch] Setting up feature branch: ${branchName}`)
  execSync('git fetch origin dev', { cwd: projectDir, stdio: 'inherit' })
  execSync('git checkout dev', { cwd: projectDir, stdio: 'inherit' })
  execSync('git pull origin dev', { cwd: projectDir, stdio: 'inherit' })
  execSync(`git checkout -b ${branchName}`, { cwd: projectDir, stdio: 'inherit' })
  console.log(`[branch] Created and switched to: ${branchName}`)
}

async function runPipeline(): Promise<void> {
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const outputFile = stageOutputFile(taskDir, stage)

    // Set up feature branch before build stage
    if (stage === 'build' && !fs.existsSync(outputFile) && !dryRun) {
      ensureFeatureBranch()
    }

    // On rerun: re-run architect so it can evaluate feedback and revise approach
    // Consume rerun-feedback.md after architect completes so subsequent pipeline:impl
    // runs don't re-trigger architect unnecessarily (e.g. if build crashes and you retry)
    const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
    if (stage === 'architect' && fs.existsSync(feedbackFile) && fs.existsSync(outputFile)) {
      writeAgentContext(taskDir) // captures old plan + feedback into .context.md
      fs.unlinkSync(outputFile)
      console.log(`[${i + 1}/${stages.length}] Rerun: deleting stale plan.md for re-evaluation`)
    }

    // R2: Delete stale verify.md on rerun (build/test were re-run, so verify must re-run)
    if (stage === 'verify' && isRerun && fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile)
      console.log(`[${i + 1}/${stages.length}] Deleted stale verify.md for re-verification`)
    }

    // Skip if output already exists
    if (fs.existsSync(outputFile)) {
      console.log(`[${i + 1}/${stages.length}] ${stage} already exists, skipping`)
      continue
    }

    console.log(
      `[${i + 1}/${stages.length}] Running ${stage} agent...${dryRun ? ' (dry-run)' : ''}`,
    )

    // R8: Write context file before invoking agent
    // On rerun + architect stage: context was already written above with old plan preserved
    if (!(stage === 'architect' && fs.existsSync(feedbackFile))) {
      writeAgentContext(taskDir)
    }

    let succeeded = false

    if (dryRun) {
      writeDryRunOutput(taskDir, stage, taskId!)
      succeeded = true
    } else {
      const timeout = STAGE_TIMEOUTS[stage] ?? DEFAULT_TIMEOUT

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          console.log(`\n🔄 Retry ${attempt}/${MAX_RETRIES} for ${stage}...`)
        }

        const result = await runAgentWithFileWatch(stage, outputFile, taskId!, timeout)

        if (result.succeeded) {
          succeeded = true
          break
        }

        if (result.timedOut) {
          const mins = Math.round(timeout / 60_000)
          console.error(
            `\n⏰ Stage "${stage}" timed out after ${mins} minutes (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
          )
          if (attempt < MAX_RETRIES) {
            console.log(`   Retrying...`)
            continue
          }
          console.error(`\n❌ Stage "${stage}" timed out ${MAX_RETRIES + 1} times for ${taskId}`)
          showStageErrorContext(stage)
          process.exit(1)
        }

        // Non-timeout failure
        console.error(`\n❌ Stage "${stage}" failed for ${taskId}`)
        showStageErrorContext(stage)
        process.exit(1)
      }
    }

    // Consume rerun-feedback.md after architect succeeds — prevents re-triggering on retry
    if (stage === 'architect' && succeeded && fs.existsSync(feedbackFile)) {
      const consumed = path.join(taskDir, 'rerun-feedback.consumed.md')
      fs.renameSync(feedbackFile, consumed)
      console.log(`   Consumed rerun-feedback.md (archived as rerun-feedback.consumed.md)`)
    }

    // R9: Validate that agent created output file
    if (succeeded) {
      const SOFT_STAGES = ['auditor']
      if (!fs.existsSync(outputFile)) {
        if (SOFT_STAGES.includes(stage)) {
          console.warn(`\n⚠️  Stage "${stage}" did not create ${outputFile} (non-blocking)`)
        } else {
          console.error(`\n❌ Stage "${stage}" completed but did not create ${outputFile}`)
          console.error(
            `The ${stage} agent MUST create an output file as specified in .opencode/agents/${stage}.md`,
          )
          console.error('Check agent definition and ensure it writes the required output.')
          process.exit(1)
        }
      }
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
      if (!dryRun) {
        commitTaskFiles()
      }
    }

    console.log(`✓ ${stage} complete`)
  }

  console.log('')
  console.log('========================================')
  console.log(`✓ Pipeline complete: ${taskId}`)
  console.log('========================================')
  console.log('')
}

runPipeline().catch((err) => {
  console.error('Pipeline error:', err)
  process.exit(1)
})
