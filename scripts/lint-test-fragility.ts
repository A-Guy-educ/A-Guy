/**
 * @fileType utility
 * @domain cody | testing
 * @pattern lint-rule
 * @ai-summary Scans cody test files for fragility patterns: exact length assertions, ghost stages, excessive mocks
 */

import fs from 'node:fs'
import path from 'node:path'

// ============================================================================
// Types
// ============================================================================

interface Finding {
  file: string
  line: number
  rule: string
  message: string
  severity: 'error' | 'warning'
}

// ============================================================================
// Patterns to detect
// ============================================================================

const GHOST_STAGES = ['autofix', 'reflect'] as const
// 'spec' requires special handling — we allow it in negative assertions

const TO_HAVE_LENGTH_RE = /\.toHaveLength\((\d+)\)/g
const VI_MOCK_RE = /vi\.mock\(/g
// Ghost stage: bare string literal (not inside .not.toContain or similar negative context)
const SPEC_GHOST_RE = /(?<!')['"]spec['"]/g

// ============================================================================
// Scanner
// ============================================================================

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = []
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const relPath = path.relative(process.cwd(), filePath)

  let viMockCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Rule 1: toHaveLength(N) where N is 7–15 (fragile stage count assertion)
    const lengthMatches = [...line.matchAll(TO_HAVE_LENGTH_RE)]
    for (const match of lengthMatches) {
      const n = parseInt(match[1], 10)
      if (n >= 7 && n <= 15) {
        findings.push({
          file: relPath,
          line: lineNum,
          rule: 'fragile-stage-count',
          message: `toHaveLength(${n}) — fragile exact stage count. Use expectMinimumStages() instead.`,
          severity: 'error',
        })
      }
    }

    // Rule 2: Ghost stage references
    for (const ghost of GHOST_STAGES) {
      // Match 'ghost' or "ghost" as standalone string literals
      const ghostRe = new RegExp(`['"]${ghost}['"]`, 'g')
      const ghostMatches = [...line.matchAll(ghostRe)]
      for (const _match of ghostMatches) {
        findings.push({
          file: relPath,
          line: lineNum,
          rule: 'ghost-stage',
          message: `Reference to removed stage '${ghost}'. This stage no longer exists in the pipeline.`,
          severity: 'warning',
        })
      }
    }

    // Rule 2b: 'spec' ghost — only flag if NOT in a negative assertion context
    const specMatches = [...line.matchAll(SPEC_GHOST_RE)]
    for (const _match of specMatches) {
      const isNegativeAssertion =
        line.includes('.not.toContain') ||
        line.includes('not.toContain') ||
        line.includes('toNotContain') ||
        line.includes('expectNoGhostStages')
      if (!isNegativeAssertion) {
        findings.push({
          file: relPath,
          line: lineNum,
          rule: 'ghost-stage',
          message: `Reference to removed stage 'spec'. Use STAGES.GAP instead (spec was merged into gap).`,
          severity: 'warning',
        })
      }
    }

    // Rule 3: Count vi.mock() calls
    const mockMatches = [...line.matchAll(VI_MOCK_RE)]
    viMockCount += mockMatches.length
  }

  // Rule 3: Excessive mocks (checked after scanning all lines)
  if (viMockCount > 4) {
    findings.push({
      file: relPath,
      line: 1,
      rule: 'excessive-mocks',
      message: `${viMockCount} vi.mock() calls (max 4). Consider integration testing or dependency injection.`,
      severity: 'warning',
    })
  }

  return findings
}

// ============================================================================
// Main
// ============================================================================

function findTestFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      results.push(path.relative(process.cwd(), fullPath))
    }
  }
  return results
}

function main() {
  const testDir = path.join(process.cwd(), 'tests/unit/scripts/cody')
  const files = findTestFiles(testDir)

  if (files.length === 0) {
    console.log(`No test files found in: ${testDir}`)
    process.exit(0)
  }

  const allFindings: Finding[] = []
  for (const file of files) {
    const fullPath = path.resolve(process.cwd(), file)
    allFindings.push(...scanFile(fullPath))
  }

  if (allFindings.length === 0) {
    console.log(`✓ ${files.length} test files scanned — no fragility issues found.`)
    process.exit(0)
  }

  // Report findings grouped by severity
  const errors = allFindings.filter((f) => f.severity === 'error')
  const warnings = allFindings.filter((f) => f.severity === 'warning')

  if (errors.length > 0) {
    console.log(`\n  ERRORS (${errors.length})\n`)
    for (const f of errors) {
      console.log(`  ${f.file}:${f.line}`)
      console.log(`    [${f.rule}] ${f.message}\n`)
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  WARNINGS (${warnings.length})\n`)
    for (const f of warnings) {
      console.log(`  ${f.file}:${f.line}`)
      console.log(`    [${f.rule}] ${f.message}\n`)
    }
  }

  console.log(
    `\n  Summary: ${files.length} files scanned, ${errors.length} errors, ${warnings.length} warnings`,
  )

  // Exit code 1 only on errors
  process.exit(errors.length > 0 ? 1 : 0)
}

try {
  main()
} catch (err: unknown) {
  console.error('lint-test-fragility failed:', err)
  process.exit(2)
}
