#!/usr/bin/env ts-node
// pipeline-rerun.ts - Re-run failed stages with feedback
// Usage: pnpm pipeline:rerun <task-id> [--feedback "issue description"] [--from <stage>]

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import readline from 'readline'
import { ALL_IMPL_STAGES, writeAgentContext } from './pipeline-utils'

const args = process.argv.slice(2)

// Simple arg parser: extract named options and positional args
function parseArgs(argv: string[]): {
  positional: string[]
  options: Record<string, string | true>
} {
  const positional: string[] = []
  const options: Record<string, string | true> = {}
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        const [key, ...rest] = arg.split('=')
        options[key.slice(2)] = rest.join('=')
      } else {
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          options[arg.slice(2)] = next
          i++
        } else {
          options[arg.slice(2)] = true
        }
      }
    } else {
      positional.push(arg)
    }
    i++
  }
  return { positional, options }
}

const parsed = parseArgs(args)
const taskId = parsed.positional[0]
const dryRun = parsed.options['dry-run'] === true

if (!taskId) {
  console.log(
    'Usage: pnpm pipeline:rerun <task-id> [--feedback "issue"] [--from <stage>] [--dry-run]',
  )
  console.log('')
  console.log('Examples:')
  console.log('  pnpm pipeline:rerun 260214-version-footer')
  console.log('  pnpm pipeline:rerun 260214-version-footer --feedback "Version not displaying"')
  console.log('  pnpm pipeline:rerun 260214-version-footer --from build')
  console.log('  pnpm pipeline:rerun 260214-version-footer --dry-run')
  console.log('')
  console.log('Options:')
  console.log('  --feedback "text"  Add feedback for what went wrong')
  console.log(`  --from <stage>     Re-run from specific stage (${ALL_IMPL_STAGES.join('|')})`)
  console.log('  --dry-run          Write mock outputs instead of calling agents')
  console.log('')
  console.log('Interactive mode (prompts for feedback) if no --feedback provided.')
  process.exit(1)
}

const projectDir = process.cwd()
const taskDir = path.join(projectDir, '.tasks', taskId)

// Validate task exists
if (!fs.existsSync(taskDir)) {
  console.error(`Error: Task directory not found: ${taskDir}`)
  process.exit(1)
}

// Parse feedback
let feedback: string | null =
  typeof parsed.options.feedback === 'string' ? parsed.options.feedback : null

// Parse from stage
let fromStage = 'build' // default to re-running from build
if (parsed.options.from) {
  const stage = typeof parsed.options.from === 'string' ? parsed.options.from : ''
  if (!ALL_IMPL_STAGES.includes(stage)) {
    console.error(`Error: Invalid stage "${stage}". Valid stages: ${ALL_IMPL_STAGES.join(', ')}`)
    process.exit(1)
  }
  fromStage = stage
}

console.log(`=== Pipeline Rerun: ${taskId}${dryRun ? ' (DRY-RUN)' : ''} ===`)
console.log(`Re-running from: ${fromStage}`)
console.log('')

// Step 1: Collect feedback (interactive if not provided)
if (!feedback) {
  console.log('📝 Provide feedback on what went wrong:')
  console.log('   (Press Enter twice when done, or Ctrl+C to cancel)')
  console.log('')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const lines: string[] = []
  let emptyLineCount = 0

  rl.on('line', (line: string) => {
    if (line.trim() === '') {
      emptyLineCount++
      if (emptyLineCount >= 2) {
        rl.close()
      }
    } else {
      emptyLineCount = 0
      lines.push(line)
    }
  })

  await new Promise((resolve) => {
    rl.on('close', () => {
      feedback = lines.join('\n').trim()
      resolve(null)
    })
  })

  if (!feedback) {
    console.log('\nNo feedback provided. Exiting.')
    process.exit(0)
  }
}

console.log('Feedback received:')
console.log('---')
console.log(feedback)
console.log('---')
console.log('')

// Step 2: Create feedback file
const feedbackFile = path.join(taskDir, 'rerun-feedback.md')
const timestamp = new Date().toISOString()

let feedbackContent = `# Rerun Feedback - ${timestamp}\n\n## Issues Found\n\n${feedback}\n\n`

// If verify.md exists and shows FAIL, include it
const verifyFile = path.join(taskDir, 'verify.md')
if (fs.existsSync(verifyFile)) {
  const verifyContent = fs.readFileSync(verifyFile, 'utf-8')
  if (/FAIL/i.test(verifyContent)) {
    feedbackContent += `## Previous Verification Results\n\n\`\`\`\n${verifyContent}\n\`\`\`\n\n`
  }
}

feedbackContent += `## Action Required\n\n`
feedbackContent += `The ${fromStage} agent should address these issues in the re-run.\n`

fs.writeFileSync(feedbackFile, feedbackContent)
console.log(`✓ Feedback saved to: rerun-feedback.md`)

// Step 3: Delete stage files from the rerun point onwards
const fromIndex = ALL_IMPL_STAGES.indexOf(fromStage)

const filesToDelete: string[] = []
for (let i = fromIndex; i < ALL_IMPL_STAGES.length; i++) {
  const stageFile = path.join(taskDir, `${ALL_IMPL_STAGES[i]}.md`)
  if (fs.existsSync(stageFile)) {
    filesToDelete.push(stageFile)
  }
}

if (filesToDelete.length > 0) {
  console.log(`\n🗑️  Deleting stage files to force re-run:`)
  filesToDelete.forEach((file) => {
    const basename = path.basename(file)
    console.log(`   - ${basename}`)
    fs.unlinkSync(file)
  })
  console.log(`✓ Deleted ${filesToDelete.length} file(s)`)
} else {
  console.log(`\nℹ️  No stage files to delete (starting fresh from ${fromStage})`)
}

// Step 4: Update .context.md to include feedback
console.log('\n📋 Updating context with feedback...')
writeAgentContext(taskDir)
console.log('✓ Context updated with feedback')

// Step 5: Optionally update spec/plan if requested
if (fromStage === 'architect') {
  console.log('\n⚠️  Re-running from architect stage.')
  console.log('    The architect agent will see the feedback in .context.md')
  console.log('    and can revise the plan accordingly.')
}

// Step 6: Run pipeline
console.log('')
console.log(`🚀 Re-running pipeline: ${ALL_IMPL_STAGES.slice(fromIndex).join(' → ')}`)
console.log('')

try {
  execSync(`pnpm pipeline:impl ${dryRun ? '--dry-run ' : ''}${taskId}`, {
    cwd: projectDir,
    stdio: 'inherit',
  })
  console.log('')
  console.log('✅ Pipeline rerun complete!')
} catch (_error) {
  console.error('')
  console.error('❌ Pipeline rerun failed')
  console.error('Review the output above and the feedback in rerun-feedback.md')
  process.exit(1)
}
