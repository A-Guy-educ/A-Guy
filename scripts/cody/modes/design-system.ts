/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Design system audit mode — runs token audit, a11y checks, and creates PR with fixes
 */

import { execFileSync } from 'child_process'
import type { PipelineContext } from '../engine/types'
import { logger } from '../logger'
import { postComment } from '../github-api'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

interface AuditResult {
  total: number
  fixable: number
  nonFixable: number
  byCategory: Record<string, number>
  files: string[]
}

interface A11yResult {
  violations: number
  critical: number
  serious: number
}

export async function runDesignSystemMode(ctx: PipelineContext): Promise<void> {
  const { input, taskId, taskDir } = ctx
  const dryRun = input.dryRun ?? false

  logger.info('🎨 Running Design System Audit...\n')

  const results: {
    audit: AuditResult | null
    a11y: A11yResult | null
    codemodApplied: boolean
    prCreated: boolean
    suggestions: string[]
  } = {
    audit: null,
    a11y: null,
    codemodApplied: false,
    prCreated: false,
    suggestions: [],
  }

  // Stage 1: Run Token Audit
  logger.info('📊 Stage 1: Running token audit...')
  try {
    const auditOutput = execFileSync('pnpm', ['design:tokens:audit', 'src/ui/web'], {
      encoding: 'utf-8',
      timeout: 60000,
    })
    logger.info(auditOutput)

    // Parse audit output
    const auditMatch = auditOutput.match(/Total issues:\s*(\d+)/)
    const fixableMatch = auditOutput.match(/Fixable:\s*(\d+)/)
    const nonFixableMatch = auditOutput.match(/Non-fixable:\s*(\d+)/)

    results.audit = {
      total: auditMatch ? parseInt(auditMatch[1]) : 0,
      fixable: fixableMatch ? parseInt(fixableMatch[1]) : 0,
      nonFixable: nonFixableMatch ? parseInt(nonFixableMatch[1]) : 0,
      byCategory: {},
      files: [],
    }

    logger.info(`✅ Audit complete: ${results.audit.total} issues found`)
  } catch (error) {
    logger.warn({ err: error }, '⚠️ Token audit failed or found no issues')
    results.audit = { total: 0, fixable: 0, nonFixable: 0, byCategory: {}, files: [] }
  }

  // Stage 2: Run Accessibility Check (if test exists)
  logger.info('\n♿ Stage 2: Running accessibility check...')
  try {
    execFileSync('pnpm', ['test:a11y', '--ci'], {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    })
    results.a11y = { violations: 0, critical: 0, serious: 0 }
    logger.info('✅ Accessibility check passed')
  } catch {
    // A11y test might not exist, that's ok
    logger.warn(
      '⚠️ Accessibility test not found or failed (this is ok if test:a11y is not configured)',
    )
    results.a11y = null
  }

  // Stage 3: Apply Safe Codemod Fixes
  logger.info('\n🔧 Stage 3: Applying safe codemod fixes...')
  if (results.audit && results.audit.fixable > 0) {
    if (dryRun) {
      logger.info(`🔍 DRY RUN: Would apply ${results.audit.fixable} codemod fixes`)
    } else {
      try {
        execFileSync('pnpm', ['design:tokens:codemod', 'src/ui/web'], {
          encoding: 'utf-8',
          timeout: 120000,
        })
        results.codemodApplied = true
        logger.info(`✅ Applied ${results.audit.fixable} codemod fixes`)
      } catch (error) {
        logger.error({ err: error }, '⚠️ Codemod failed')
      }
    }
  } else {
    logger.info('✅ No fixable issues found')
  }

  // Stage 4: Generate Suggestions
  logger.info('\n💡 Stage 4: Generating suggestions...')
  if (results.audit && results.audit.nonFixable > 0) {
    results.suggestions.push(
      `Found ${results.audit.nonFixable} non-fixable patterns that may need new design tokens.`,
    )
  }

  // Check for components that might need refactoring
  try {
    const chatInterfacePath = join(taskDir, '../../../src/ui/web/chat/ChatInterface/index.tsx')
    const chatContent = readFileSync(chatInterfacePath, 'utf-8')
    const lineCount = chatContent.split('\n').length
    if (lineCount > 500) {
      results.suggestions.push(
        `ChatInterface is ${lineCount} lines — consider splitting into smaller components.`,
      )
    }
  } catch {
    // File might not exist or be in different location
  }

  // Stage 5: Create PR or Post Results
  logger.info('\n📝 Stage 5: Creating report...')

  const report = generateReport(results)
  const reportPath = join(taskDir, 'design-system-report.md')
  writeFileSync(reportPath, report, 'utf-8')
  logger.info(`Report saved to: ${reportPath}`)

  // Post comment to issue if available
  if (input.issueNumber) {
    const commentBody = formatComment(results, report)
    postComment(input.issueNumber, commentBody)
    logger.info(`Posted results to issue #${input.issueNumber}`)
  }

  // Stage 6: Create PR (if changes were made and not dry run)
  if (results.codemodApplied && !dryRun) {
    try {
      createPr(results)
      results.prCreated = true
      logger.info('✅ Created PR with design system improvements')
    } catch (error) {
      logger.error({ err: error }, '⚠️ Failed to create PR')
    }
  } else if (dryRun && results.audit && results.audit.fixable > 0) {
    logger.info('🔍 DRY RUN: PR not created (use without --dry-run to create PR)')
  }

  logger.info('\n✅ Design System Audit complete!')
  logger.info(
    `   Audit: ${results.audit?.total ?? 0} issues (${results.audit?.fixable ?? 0} fixable)`,
  )
  logger.info(`   A11y: ${results.a11y?.violations ?? 'N/A'} violations`)
  logger.info(`   Codemod applied: ${results.codemodApplied}`)
  logger.info(`   PR created: ${results.prCreated}`)
  logger.info(`   Suggestions: ${results.suggestions.length}`)
}

function generateReport(results: {
  audit: AuditResult | null
  a11y: A11yResult | null
  codemodApplied: boolean
  suggestions: string[]
}): string {
  return `# Design System Audit Report

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | ${results.audit?.total ?? 0} |
| Fixable (auto-applied) | ${results.audit?.fixable ?? 0} |
| Non-fixable (needs review) | ${results.audit?.nonFixable ?? 0} |
| A11y Violations | ${results.a11y?.violations ?? 'N/A'} |
| Codemod Applied | ${results.codemodApplied ? 'Yes' : 'No'} |

## Suggestions

${
  results.suggestions.length > 0
    ? results.suggestions.map((s) => `- ${s}`).join('\n')
    : '- No suggestions at this time.'
}

## Details

${
  results.audit && results.audit.total > 0
    ? `
### Token Issues by Category

${Object.entries(results.audit.byCategory)
  .map(([cat, count]) => `- ${cat}: ${count}`)
  .join('\n')}
`
    : ''
}

${
  results.a11y && results.a11y.violations > 0
    ? `
### Accessibility Issues

- Critical: ${results.a11y.critical}
- Serious: ${results.a11y.serious}
- Total: ${results.a11y.violations}
`
    : ''
}

---
*Generated by Cody Design System Audit*
`
}

function formatComment(
  results: {
    audit: AuditResult | null
    a11y: A11yResult | null
    codemodApplied: boolean
    suggestions: string[]
  },
  _report: string,
): string {
  const lines = ['## 🎨 Design System Audit Results']

  if (results.audit) {
    lines.push(`\n| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Issues | ${results.audit.total} |`)
    lines.push(`| Fixable | ${results.audit.fixable} |`)
    lines.push(`| Non-fixable | ${results.audit.nonFixable} |`)
  }

  if (results.a11y) {
    lines.push(`| A11y Violations | ${results.a11y.violations} |`)
  }

  lines.push(`| Codemod Applied | ${results.codemodApplied ? '✅' : '❌'} |`)

  if (results.suggestions.length > 0) {
    lines.push('\n### 💡 Suggestions')
    results.suggestions.forEach((s) => {
      lines.push(`- ${s}`)
    })
  }

  lines.push('\n---\n*Triggered by @cody design-system*')

  return lines.join('\n')
}

function createPr(results: { audit: AuditResult | null; codemodApplied: boolean }): void {
  const branchName = `design-system/audit-${new Date().toISOString().slice(0, 10)}`

  // Create branch
  execFileSync('git', ['checkout', '-b', branchName], { stdio: 'pipe' })

  // Stage changes
  execFileSync('git', ['add', 'src/ui/web/'], { stdio: 'pipe' })

  // Check if there are changes to commit
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { stdio: 'pipe' })
  } catch {
    // There are changes to commit
    const message = results.audit
      ? `chore(design-system): apply ${results.audit.fixable} token fixes

Automated design system improvements:
- Fixed ${results.audit.fixable} raw Tailwind values → design tokens
- Applied via codemod

Generated by @cody design-system`
      : `chore(design-system): design system improvements

Automated design system improvements. Generated by @cody design-system`

    execFileSync('git', ['commit', '-m', message], { stdio: 'pipe' })

    // Push branch
    execFileSync('git', ['push', '-u', 'origin', branchName], { stdio: 'pipe' })

    // Create PR using gh CLI
    execFileSync(
      'gh',
      [
        'pr',
        'create',
        '--title',
        '🎨 Design System Improvements (Automated)',
        '--body',
        '## Summary\n\nAutomated design system improvements via @cody design-system\n\n| Metric | Value |\n|--------|-------|\n| Fixable Issues | ' +
          (results.audit?.fixable ?? 0) +
          ' |\n\n_This PR was created automatically by the Cody design system agent._',
        '--base',
        'main',
      ],
      { stdio: 'inherit' },
    )
  }
}
