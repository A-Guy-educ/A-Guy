/**
 * @fileType utility
 * @domain ci | cody | pipeline
 * @pattern scripted-stages
 * @ai-summary Direct script execution for verify and PR stages — no LLM needed for mechanical tasks
 */

import { execFileSync, execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { getDefaultBranch, commitAndPush } from './git-utils'

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

/** Default timeout per gate (2 minutes) */
const DEFAULT_GATE_TIMEOUT = 120_000

function runGate(
  name: string,
  command: string,
  cwd: string,
  timeout: number = DEFAULT_GATE_TIMEOUT,
): GateResult {
  console.log(`  Running ${name}...`)
  try {
    const output = execSync(command, { cwd, encoding: 'utf-8', timeout })
    console.log(`  ✅ ${name} passed`)
    return { name, passed: true, output: output.slice(0, 500) }
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = (err.stdout || '') + (err.stderr || '') || err.message || 'Unknown error'
    console.log(`  ❌ ${name} failed`)
    return { name, passed: false, output: output.slice(0, 2000) }
  }
}

export function runVerifyStage(
  outputFile: string,
  cwd: string = process.cwd(),
  timeout?: number,
): VerifyResult {
  console.log('\n🔍 Running verification (scripted)...\n')

  // Aggregate timeout - total time allowed for all gates combined
  const startTime = Date.now()
  const aggregateTimeout = timeout ?? Infinity

  const gateDefinitions = [
    { name: 'TypeScript', command: 'pnpm -s tsc --noEmit' },
    { name: 'Lint', command: 'pnpm -s lint' },
    { name: 'Format', command: 'pnpm -s format:check' },
    { name: 'Unit Tests', command: 'pnpm -s test:unit' },
    // Integration tests run in CI after PR is created
    // Adding them here would require MongoDB service in verify stage
  ]

  const gates: GateResult[] = []
  for (const gateDef of gateDefinitions) {
    const elapsed = Date.now() - startTime
    const remaining = aggregateTimeout - elapsed

    if (remaining <= 0) {
      // Aggregate timeout exceeded - skip remaining gates
      gates.push({
        name: gateDef.name,
        passed: false,
        output: 'SKIPPED: aggregate timeout exceeded',
      })
      continue
    }

    // Use smaller of remaining aggregate time or per-gate default
    const gateTimeout = Math.min(remaining, DEFAULT_GATE_TIMEOUT)
    gates.push(runGate(gateDef.name, gateDef.command, cwd, gateTimeout))
  }

  const allPassed = gates.every((g) => g.passed)

  const lines: string[] = ['# Verification Report\n']
  for (const gate of gates) {
    const icon = gate.passed
      ? 'PASS ✅'
      : gate.output.includes('SKIPPED')
        ? 'SKIPPED ❌'
        : 'FAIL ❌'
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

function getExistingPr(branch: string, cwd: string): string | null {
  try {
    const output = execFileSync(
      'gh',
      ['pr', 'list', '--head', branch, '--json', 'url', '--jq', '.[0].url'],
      {
        cwd,
        encoding: 'utf-8',
      },
    ).trim()
    return output || null
  } catch {
    return null
  }
}

function getCommitSummary(defaultBranch: string, cwd: string): string {
  try {
    // Use execFileSync to prevent shell injection via branch names
    return execFileSync('git', ['log', '--oneline', `${defaultBranch}..HEAD`], {
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

  // Read spec for context — extract ## Overview section if present
  const specPath = path.join(taskDir, 'spec.md')
  let specSummary = ''
  if (fs.existsSync(specPath)) {
    const spec = fs.readFileSync(specPath, 'utf-8')
    // Try to extract the ## Overview section
    const overviewMatch = spec.match(/##\s*Overview\n([\s\S]*?)(?=\n##\s|$)/)
    if (overviewMatch) {
      specSummary = overviewMatch[1].trim()
    } else {
      // Fallback: first paragraph (up to first blank line or 500 chars)
      const firstPara = spec.split(/\n\n/)[0] || ''
      specSummary = firstPara.slice(0, 500).trim()
    }
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
    execFileSync('git', ['push', '-u', 'origin', branch], { cwd, stdio: 'inherit' })
  } catch {
    console.log('  Push failed (may already be up to date)')
  }

  // Step 3: Build title and body
  const title = buildPrTitle(taskDir, defaultBranch, cwd)
  const body = buildPrBody(taskDir, defaultBranch, cwd)

  console.log(`  Title: ${title}`)

  // Step 4: Create PR via gh CLI — use execFileSync with arg array to prevent injection
  let prUrl = ''
  try {
    prUrl = execFileSync(
      'gh',
      ['pr', 'create', '--title', title, '--base', defaultBranch, '--body-file', '-'],
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

// ============================================================================
// Commit Stage — commit and push changes via git-utils
// ============================================================================

interface CommitResult {
  success: boolean
  hash: string
  branch: string
  message: string
  report: string
}

export function runCommitStage(
  taskDir: string,
  outputFile: string,
  cwd: string = process.cwd(),
): CommitResult {
  console.log('\n📦 Committing changes (scripted)...\n')

  // Extract task ID from taskDir path
  const taskId = path.basename(taskDir)

  const result = commitAndPush(taskId, taskDir, cwd)

  const lines = [`# Commit Stage\n`]

  if (result.success) {
    lines.push(`✅ **Committed and pushed**\n`)
    lines.push(`- **Branch:** ${result.branch}`)
    lines.push(`- **Hash:** ${result.hash}`)
    console.log(`  ✅ ${result.message}`)
  } else {
    lines.push(`⚠️ **Commit status:** ${result.message}\n`)
    if (result.message.includes('No changes')) {
      console.log(`  ℹ️ ${result.message}`)
    } else {
      console.error(`  ❌ ${result.message}`)
    }
  }

  const report = lines.join('\n')
  fs.writeFileSync(outputFile, report)

  return {
    success: result.success,
    hash: result.hash,
    branch: result.branch,
    message: result.message,
    report,
  }
}
