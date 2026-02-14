#!/usr/bin/env ts-node
// pipeline-rerun.ts - Re-run failed stages with feedback
// Usage: pnpm pipeline:rerun <task-id> [--feedback "issue description"] [--from <stage>]

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import readline from 'readline'

const args = process.argv.slice(2)
const taskId = args.find((arg) => !arg.startsWith('--'))
const feedbackArg = args.find((arg) => arg.startsWith('--feedback'))
const fromArg = args.find((arg) => arg.startsWith('--from'))

if (!taskId) {
  console.log('Usage: pnpm pipeline:rerun <task-id> [--feedback "issue"] [--from <stage>]')
  console.log('')
  console.log('Examples:')
  console.log('  pnpm pipeline:rerun 260214-version-footer')
  console.log('  pnpm pipeline:rerun 260214-version-footer --feedback "Version not displaying"')
  console.log('  pnpm pipeline:rerun 260214-version-footer --from build')
  console.log('')
  console.log('Options:')
  console.log('  --feedback "text"  Add feedback for what went wrong')
  console.log('  --from <stage>     Re-run from specific stage (plan|build|test|verify)')
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
let feedback: string | null = null
if (feedbackArg) {
  feedback = feedbackArg.split('=')[1]?.replace(/^["']|["']$/g, '') || null
}

// Parse from stage
const validStages = ['plan', 'build', 'test', 'verify', 'auditor', 'pr']
let fromStage = 'build' // default to re-running from build
if (fromArg) {
  const stage = fromArg.split('=')[1]
  if (!validStages.includes(stage)) {
    console.error(`Error: Invalid stage "${stage}". Valid stages: ${validStages.join(', ')}`)
    process.exit(1)
  }
  fromStage = stage
}

console.log(`=== Pipeline Rerun: ${taskId} ===`)
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
const stageOrder = ['plan', 'build', 'test', 'verify', 'auditor', 'pr']
const fromIndex = stageOrder.indexOf(fromStage)

const filesToDelete: string[] = []
for (let i = fromIndex; i < stageOrder.length; i++) {
  const stageFile = path.join(taskDir, `${stageOrder[i]}.md`)
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

const contextFiles = [
  'task.md',
  'spec.md',
  'clarified.md',
  'plan.md',
  'build.md',
  'test.md',
  'verify.md',
  'rerun-feedback.md', // Include feedback
]

const parts: string[] = []
for (const file of contextFiles) {
  const p = path.join(taskDir, file)
  if (fs.existsSync(p)) {
    parts.push(`# ${file}\n\n${fs.readFileSync(p, 'utf-8')}`)
  }
}

fs.writeFileSync(path.join(taskDir, '.context.md'), parts.join('\n\n---\n\n'))
console.log('✓ Context updated with feedback')

// Step 5: Optionally update spec/plan if requested
if (fromStage === 'plan') {
  console.log('\n⚠️  Re-running from plan stage.')
  console.log('    The plan agent will see the feedback in .context.md')
  console.log('    and can revise the plan accordingly.')
}

// Step 6: Ask user to confirm
console.log('')
console.log('═══════════════════════════════════════════════════════════')
console.log('Ready to re-run pipeline from:', fromStage)
console.log('═══════════════════════════════════════════════════════════')
console.log('')
console.log('The following will happen:')
console.log(`  1. Pipeline will skip stages before ${fromStage}`)
console.log(`  2. ${fromStage} agent will see feedback in .context.md`)
console.log(`  3. Pipeline continues: ${stageOrder.slice(fromIndex).join(' → ')}`)
console.log('')
console.log('Run this command to continue:')
console.log('')
console.log(`  pnpm pipeline:impl ${taskId}`)
console.log('')
console.log('Or run with auto-continue (if you trust the setup):')
console.log('')
console.log(`  pnpm pipeline:impl ${taskId} && echo "✅ Pipeline complete"`)
console.log('')

// Optional: Auto-run if --auto flag is present
if (args.includes('--auto')) {
  console.log('🚀 Auto-run enabled, starting pipeline...')
  console.log('')
  try {
    execSync(`pnpm pipeline:impl ${taskId}`, {
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
}
