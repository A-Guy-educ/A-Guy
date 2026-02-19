/**
 * @fileType utility
 * @domain ci | cody | pipeline
 * @pattern scripted-stages
 * @ai-summary Direct script execution for verify and PR stages — no LLM needed for mechanical tasks
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Verify Stage — run quality gates directly
// ============================================================================

interface VerifyResult {
  passed: boolean
  report: string
}

interface GateResult {
  name: string
  passed: boolean
  output: string
}

function runGate(name: string, command: string, cwd: string): GateResult {
  console.log(`  Running ${name}...`)
  try {
    const output = execSync(command, { cwd, encoding: 'utf-8', timeout: 120_000 })
    console.log(`  ✅ ${name} passed`)
    return { name, passed: true, output: output.slice(0, 500) }
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = (err.stdout || '') + (err.stderr || '') || err.message || 'Unknown error'
    console.log(`  ❌ ${name} failed`)
    return { name, passed: false, output: output.slice(0, 2000) }
  }
}

export function runVerifyStage(outputFile: string, cwd: string = process.cwd()): VerifyResult {
  console.log('\n🔍 Running verification (scripted)...\n')

  const gates: GateResult[] = [
    runGate('TypeScript', 'pnpm -s tsc --noEmit', cwd),
    runGate('Lint', 'pnpm -s lint', cwd),
    runGate('Format', 'pnpm -s format', cwd),
  ]

  const allPassed = gates.every((g) => g.passed)

  const lines: string[] = ['# Verification Report\n']
  for (const gate of gates) {
    const icon = gate.passed ? 'PASS ✅' : 'FAIL ❌'
    lines.push(`## ${gate.name}: ${icon}\n`)
    if (!gate.passed) {
      lines.push('```')
      lines.push(gate.output)
      lines.push('```\n')
    }
  }

  lines.push(`\n## Result: ${allPassed ? 'PASS' : 'FAIL'}`)

  const report = lines.join('\n')
  fs.writeFileSync(outputFile, report)
  console.log(`\n${allPassed ? '✅' : '❌'} Verification ${allPassed ? 'passed' : 'failed'}`)

  return { passed: allPassed, report }
}

// ============================================================================
// PR Stage — create PR directly via gh CLI
// ============================================================================

interface PrResult {
  created: boolean
  url: string
  report: string
}

function getBranchName(cwd: string): string {
  return execSync('git branch --show-current', { cwd, encoding: 'utf-8' }).trim()
}

function getDefaultBranch(cwd: string): string {
  try {
    return execSync("git remote show origin | grep 'HEAD branch' | cut -d' ' -f5", {
      cwd,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return 'dev'
  }
}

function getExistingPr(branch: string, cwd: string): string | null {
  try {
    const output = execSync(`gh pr list --head "${branch}" --json url --jq '.[0].url'`, {
      cwd,
      encoding: 'utf-8',
    }).trim()
    return output || null
  } catch {
    return null
  }
}

function getCommitSummary(defaultBranch: string, cwd: string): string {
  try {
    return execSync(`git log --oneline ${defaultBranch}..HEAD`, {
      cwd,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

function buildPrTitle(taskDir: string, defaultBranch: string, cwd: string): string {
  // Read task.md for context
  const taskMdPath = path.join(taskDir, 'task.md')
  let taskDescription = ''
  if (fs.existsSync(taskMdPath)) {
    taskDescription = fs
      .readFileSync(taskMdPath, 'utf-8')
      .replace(/^#\s*Task\s*/i, '')
      .trim()
  }

  // Read task.json for type
  const taskJsonPath = path.join(taskDir, 'task.json')
  let taskType = 'feat'
  if (fs.existsSync(taskJsonPath)) {
    try {
      const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'))
      const typeMap: Record<string, string> = {
        fix_bug: 'fix',
        implement_feature: 'feat',
        refactor: 'refactor',
        docs: 'docs',
        ops: 'chore',
        research: 'chore',
      }
      taskType = typeMap[taskJson.task_type] || 'feat'
    } catch {
      // ignore
    }
  }

  // Get first line of task description as summary
  const firstLine = taskDescription.split('\n')[0].trim()

  // Use commit messages as fallback
  if (!firstLine) {
    const commits = getCommitSummary(defaultBranch, cwd)
    const firstCommit = commits.split('\n')[0] || 'implement changes'
    // Strip commit hash
    return `${taskType}: ${firstCommit.replace(/^[a-f0-9]+\s+/, '')}`
  }

  // Truncate to reasonable length
  const summary = firstLine.length > 72 ? firstLine.slice(0, 69) + '...' : firstLine
  return `${taskType}: ${summary.toLowerCase()}`
}

function buildPrBody(taskDir: string, defaultBranch: string, cwd: string): string {
  const commits = getCommitSummary(defaultBranch, cwd)

  // Read spec for context
  const specPath = path.join(taskDir, 'spec.md')
  let specSummary = ''
  if (fs.existsSync(specPath)) {
    const spec = fs.readFileSync(specPath, 'utf-8')
    // Take first 500 chars of spec as summary
    specSummary = spec.slice(0, 500)
  }

  const lines = ['## Summary\n']

  if (specSummary) {
    lines.push(specSummary)
    lines.push('')
  }

  if (commits) {
    lines.push('## Commits\n')
    lines.push('```')
    lines.push(commits)
    lines.push('```')
  }

  lines.push('\n---\n🤖 Generated by Cody pipeline')

  return lines.join('\n')
}

export function runPrStage(
  taskDir: string,
  outputFile: string,
  cwd: string = process.cwd(),
): PrResult {
  console.log('\n📝 Creating PR (scripted)...\n')

  const branch = getBranchName(cwd)
  const defaultBranch = getDefaultBranch(cwd)

  // Step 1: Check for existing PR
  const existingUrl = getExistingPr(branch, cwd)
  if (existingUrl) {
    console.log(`  PR already exists: ${existingUrl}`)
    const report = `# PR Stage\n\nExisting PR found: ${existingUrl}\n`
    fs.writeFileSync(outputFile, report)
    return { created: false, url: existingUrl, report }
  }

  // Step 2: Push branch
  console.log(`  Pushing branch ${branch}...`)
  try {
    execSync(`git push -u origin ${branch}`, { cwd, stdio: 'inherit' })
  } catch {
    console.log('  Push failed (may already be up to date)')
  }

  // Step 3: Build title and body
  const title = buildPrTitle(taskDir, defaultBranch, cwd)
  const body = buildPrBody(taskDir, defaultBranch, cwd)

  console.log(`  Title: ${title}`)

  // Step 4: Create PR via gh CLI using stdin for body
  let prUrl = ''
  try {
    prUrl = execSync(
      `gh pr create --title "${title.replace(/"/g, '\\"')}" --base "${defaultBranch}" --body-file -`,
      {
        cwd,
        encoding: 'utf-8',
        input: body,
        stdio: ['pipe', 'pipe', 'inherit'],
      },
    ).trim()
    console.log(`  ✅ PR created: ${prUrl}`)
  } catch (error: unknown) {
    const err = error as { message?: string }
    const msg = err.message || 'Unknown error'
    console.error(`  ❌ PR creation failed: ${msg}`)
    const report = `# PR Stage\n\nFailed to create PR: ${msg}\n`
    fs.writeFileSync(outputFile, report)
    return { created: false, url: '', report }
  }

  const report = `# PR Stage\n\nPR created: ${prUrl}\n\nTitle: ${title}\n`
  fs.writeFileSync(outputFile, report)
  return { created: true, url: prUrl, report }
}
