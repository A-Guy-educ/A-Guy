#!/usr/bin/env npx tsx
/**
 * Quality Check Script
 *
 * @fileType utility
 * @domain quality, automation
 * @ai-summary Run all quality gates (tsc, lint, format, tests) and generate a structured report
 */

import { execSync, exec } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parseArgs } from 'util'

// ─────────────────────────────────────────────
// Configuration - Read from package.json
// ─────────────────────────────────────────────

interface PackageJsonScripts {
  scripts?: Record<string, string>
}

function getPackageJsonScripts(): Record<string, string> {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json')
    if (existsSync(pkgPath)) {
      const content = readFileSync(pkgPath, 'utf-8')
      const pkg: PackageJsonScripts = JSON.parse(content)
      return pkg.scripts || {}
    }
  } catch (_) {
    // Ignore errors, use defaults
  }
  return {}
}

function getScriptCommand(scriptName: string, fallback: string): string {
  const scripts = getPackageJsonScripts()

  // Try exact match first
  if (scripts[scriptName]) {
    // Extract the command (remove pnpm/npm/yarn prefix)
    const cmd = scripts[scriptName].replace(/^(pnpm|npm|yarn)\s+/, '')
    return `pnpm ${cmd}`
  }

  // Try common aliases
  const aliases: Record<string, string[]> = {
    tsc: ['tsc:check', 'typecheck', 'type-check'],
    lint: ['lint:check', 'eslint'],
    format: ['format:check', 'prettier:check'],
    test: ['test:unit', 'test:run'],
  }

  for (const [key, alternatives] of Object.entries(aliases)) {
    if (scriptName === key) {
      for (const alt of alternatives) {
        if (scripts[alt]) {
          const cmd = scripts[alt].replace(/^(pnpm|npm|yarn)\s+/, '')
          return `pnpm ${cmd}`
        }
      }
    }
  }

  return fallback
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CheckResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  output: string
  errorCount?: number
}

interface QualityReport {
  timestamp: string
  status: 'passed' | 'failed'
  checks: CheckResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
  recommendations: string[]
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
}

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`)
}

function logCheck(name: string, status: 'passed' | 'failed' | 'skipped', duration: number) {
  const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '-'
  const color =
    status === 'passed' ? COLORS.green : status === 'failed' ? COLORS.red : COLORS.yellow
  log(`  ${icon} ${name}${COLORS.gray} (${duration}ms)${COLORS.reset}`, color)
}

function runCommand(cmd: string, timeout = 120000): CheckResult {
  const start = Date.now()
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return {
      name: cmd.split(' ')[1] || cmd.split(' ')[0],
      status: 'passed',
      duration: Date.now() - start,
      output,
    }
  } catch (error: unknown) {
    const duration = Date.now() - start
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = err.stdout || err.message || ''
    const stderr = err.stderr || ''

    // Try to extract error count from tsc output
    let errorCount: number | undefined
    const tscMatch = output.match(/Found (\d+) error/)
    if (tscMatch) {
      errorCount = parseInt(tscMatch[1], 10)
    }

    return {
      name: cmd.split(' ')[1] || cmd.split(' ')[0],
      status: 'failed',
      duration,
      output: output + (stderr ? `\n${stderr}` : ''),
      errorCount,
    }
  }
}

// Keep for future async implementation
function _runCommandAsync(cmd: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
      const duration = Date.now() - start
      if (error) {
        let errorCount: number | undefined
        const tscMatch = stdout.match(/Found (\d+) error/)
        if (tscMatch) {
          errorCount = parseInt(tscMatch[1], 10)
        }
        resolve({
          name: cmd.split(' ')[1] || cmd.split(' ')[0],
          status: 'failed',
          duration,
          output: stdout + (stderr ? `\n${stderr}` : ''),
          errorCount,
        })
      } else {
        resolve({
          name: cmd.split(' ')[1] || cmd.split(' ')[0],
          status: 'passed',
          duration,
          output: stdout,
        })
      }
    })
  })
}

// ─────────────────────────────────────────────
// Report Generation
// ─────────────────────────────────────────────

function generateMarkdownReport(report: QualityReport): string {
  const { timestamp, status, checks, summary, recommendations } = report

  let md = `# Quality Check Report\n\n`
  md += `**Date**: ${timestamp}\n`
  md += `**Status**: ${status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n\n`
  md += `## Summary\n\n`
  md += `- Total: ${summary.total}\n`
  md += `- Passed: ${summary.passed}\n`
  md += `- Failed: ${summary.failed}\n`
  md += `- Skipped: ${summary.skipped}\n\n`
  md += `---\n\n`

  for (const check of checks) {
    const icon = check.status === 'passed' ? '✅' : check.status === 'failed' ? '❌' : '⏭️'
    md += `## ${check.name}\n\n`
    md += `**Status**: ${icon} ${check.status.toUpperCase()}`
    if (check.errorCount !== undefined) {
      md += ` (${check.errorCount} errors)`
    }
    md += `\n`
    md += `**Duration**: ${check.duration}ms\n\n`

    if (check.status === 'failed' && check.output) {
      // Truncate long output
      const maxLines = 50
      const lines = check.output.split('\n').filter((l) => l.trim())
      const truncated = lines.length > maxLines ? [...lines.slice(0, maxLines), '...'] : lines
      md += `\`\`\`\n${truncated.join('\n')}\n\`\`\`\n\n`
    }
  }

  if (recommendations.length > 0) {
    md += `---\n\n## Recommendations\n\n`
    for (const rec of recommendations) {
      md += `- ${rec}\n`
    }
    md += `\n`
  }

  return md
}

function generateJSONReport(report: QualityReport): string {
  return JSON.stringify(report, null, 2)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  // Parse CLI arguments
  const { values } = parseArgs({
    options: {
      fix: { type: 'boolean', short: 'f', default: false },
      'skip-tests': { type: 'boolean', default: false },
      output: { type: 'string', short: 'o' },
      json: { type: 'boolean', default: false },
      tsc: { type: 'string', default: '' },
      lint: { type: 'string', default: '' },
      format: { type: 'string', default: '' },
      test: { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Quality Check Script

Usage: npx tsx .agents/skills/quality-check/scripts/quality-check.ts [options]

Options:
  --fix           Run auto-fix (lint:fix, format:fix) before checking
  --skip-tests    Skip test suite (faster)
  --output <file> Write report to file instead of stdout
  --json          Output JSON instead of markdown
  --tsc <cmd>     Override tsc command (default: auto-detect from package.json)
  --lint <cmd>    Override lint command (default: auto-detect)
  --format <cmd>  Override format command (default: auto-detect)
  --test <cmd>    Override test command (default: auto-detect)
  --help          Show this help message
`)
    process.exit(0)
  }

  // Get commands (from CLI or auto-detect from package.json)
  const tscCmd = values.tsc || getScriptCommand('tsc', 'pnpm -s tsc --noEmit')
  const lintCmd = values.lint || getScriptCommand('lint', 'pnpm -s lint')
  const formatCmd = values.format || getScriptCommand('format', 'pnpm -s format')
  const testCmd = values.test || getScriptCommand('test', 'pnpm -s test')

  log(`\n${COLORS.blue}═══════════════════════════════════════${COLORS.reset}`)
  log(`${COLORS.blue}  Quality Check${COLORS.reset}`)
  log(`${COLORS.blue}═══════════════════════════════════════${COLORS.reset}\n`)

  log(`${COLORS.gray}Using commands:${COLORS.reset}`)
  log(`${COLORS.gray}  TypeScript: ${tscCmd}${COLORS.reset}`)
  log(`${COLORS.gray}  Lint:      ${lintCmd}${COLORS.reset}`)
  log(`${COLORS.gray}  Format:    ${formatCmd}${COLORS.reset}`)
  log(`${COLORS.gray}  Tests:     ${testCmd}${COLORS.reset}\n`)

  const checks: CheckResult[] = []
  const recommendations: string[] = []

  // Step 1: Auto-fix if requested
  if (values.fix) {
    log(`${COLORS.yellow}Running auto-fix...${COLORS.reset}`)
    try {
      execSync('pnpm lint:fix', { encoding: 'utf-8', stdio: 'inherit' })
      log(`${COLORS.green}✓ lint:fix complete${COLORS.reset}\n`)
    } catch (_) {
      log(`${COLORS.red}✗ lint:fix had issues${COLORS.reset}\n`)
    }
    try {
      execSync('pnpm format:fix', { encoding: 'utf-8', stdio: 'inherit' })
      log(`${COLORS.green}✓ format:fix complete${COLORS.reset}\n`)
    } catch (_) {
      log(`${COLORS.red}✗ format:fix had issues${COLORS.reset}\n`)
    }
  }

  // Step 2: Run quality gates
  log(`${COLORS.blue}Running quality gates...${COLORS.reset}\n`)

  // TypeScript Check
  const tscResult = runCommand(tscCmd, 180000)
  checks.push(tscResult)
  logCheck('TypeScript', tscResult.status, tscResult.duration)

  if (tscResult.status === 'failed') {
    if (tscResult.output.includes('Found 0 error')) {
      // Sometimes tsc fails but has no errors - weird edge case
    } else if (tscResult.output.includes('payload-types')) {
      recommendations.push('Run `pnpm generate:types` to regenerate Payload types')
    } else {
      recommendations.push('Review TypeScript errors and fix them')
    }
  }

  // Lint Check
  const lintResult = runCommand(lintCmd, 180000)
  checks.push(lintResult)
  logCheck('Lint', lintResult.status, lintResult.duration)

  if (lintResult.status === 'failed') {
    recommendations.push('Run `pnpm lint:fix` to auto-fix lint issues')
  }

  // Format Check
  const formatResult = runCommand(formatCmd, 60000)
  checks.push(formatResult)
  logCheck('Format', formatResult.status, formatResult.duration)

  if (formatResult.status === 'failed') {
    recommendations.push('Run `pnpm format:fix` to auto-fix formatting')
  }

  // Tests (skip if requested)
  if (!values['skip-tests']) {
    const testResult = runCommand(testCmd, 300000)
    checks.push(testResult)
    logCheck('Tests', testResult.status, testResult.duration)

    if (testResult.status === 'failed') {
      recommendations.push('Review failing tests and fix them')
    }
  } else {
    checks.push({
      name: 'Tests',
      status: 'skipped',
      duration: 0,
      output: 'Skipped by user request',
    })
    logCheck('Tests', 'skipped', 0)
  }

  // Step 3: Generate report
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const failedCount = checks.filter((c) => c.status === 'failed').length
  const passedCount = checks.filter((c) => c.status === 'passed').length
  const skippedCount = checks.filter((c) => c.status === 'skipped').length

  const report: QualityReport = {
    timestamp,
    status: failedCount === 0 ? 'passed' : 'failed',
    checks,
    summary: {
      total: checks.length,
      passed: passedCount,
      failed: failedCount,
      skipped: skippedCount,
    },
    recommendations,
  }

  // Step 4: Output
  console.log('')
  if (report.status === 'passed') {
    log(`${COLORS.green}═══════════════════════════════════════${COLORS.reset}`)
    log(`${COLORS.green}  ✅ All checks passed!${COLORS.reset}`)
    log(`${COLORS.green}═══════════════════════════════════════${COLORS.reset}\n`)
  } else {
    log(`${COLORS.red}═══════════════════════════════════════${COLORS.reset}`)
    log(`${COLORS.red}  ❌ ${failedCount} check(s) failed${COLORS.reset}`)
    log(`${COLORS.red}═══════════════════════════════════════${COLORS.reset}\n`)

    if (recommendations.length > 0) {
      log(`${COLORS.yellow}Recommendations:${COLORS.reset}`)
      for (const rec of recommendations) {
        log(`  - ${rec}`)
      }
      console.log('')
    }
  }

  // Write output
  if (values.output) {
    const content = values.json ? generateJSONReport(report) : generateMarkdownReport(report)
    writeFileSync(values.output, content, 'utf-8')
    log(`${COLORS.gray}Report written to: ${values.output}${COLORS.reset}`)
  } else if (!values.json) {
    // Print markdown summary to console
    console.log(generateMarkdownReport(report))
  } else {
    console.log(generateJSONReport(report))
  }

  // Exit code
  process.exit(report.status === 'passed' ? 0 : 1)
}

main().catch((error) => {
  console.error('Quality check failed with error:', error)
  process.exit(1)
})
