/**
 * @fileType plugin
 * @domain inspector
 * @pattern security-scanner-plugin
 * @ai-summary Scans for security vulnerabilities in API routes, collections, and source code
 *
 * Runs 4 scans:
 * 1. API routes missing authentication
 * 2. API routes using overrideAccess: true
 * 3. Collections with permissive 'anyone' access on write operations
 * 4. Hardcoded secrets in source files
 *
 * Posts digest to issue #817 and creates GitHub issues for critical findings.
 * No LLM calls — purely deterministic pattern matching.
 */

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import { runAllScans } from './scanner'

const DEDUP_WINDOW_MINUTES = 23 * 60
const SECURITY_LABEL = 'type:security'

/**
 * Security Scanner plugin.
 *
 * Runs ~daily (every 6th cycle + 23h dedup).
 */
export const securityScannerPlugin: InspectorPlugin = {
  name: 'security-scanner',
  description: 'Scan for security vulnerabilities in API routes, collections, and source code',
  domain: 'project',
  schedule: { every: 6 },

  async run(ctx): Promise<ActionRequest[]> {
    ctx.log.debug('Running security-scanner plugin')

    const findings = runAllScans(process.cwd())

    if (findings.length === 0) {
      ctx.log.info('No security findings — skipping security-scanner')
      return []
    }

    ctx.log.info(
      {
        totalFindings: findings.length,
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
      },
      'Security scan complete',
    )

    const actions: ActionRequest[] = []

    // Digest comment action
    if (ctx.digestIssue) {
      actions.push({
        plugin: 'security-scanner',
        type: 'digest',
        urgency: 'info',
        title: '🔒 Security Scan Report',
        detail: formatDigestSummary(findings),
        dedupKey: 'security-scanner:digest-daily',
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          if (!execCtx.digestIssue) {
            return { success: false, message: 'Digest issue not configured at execution time' }
          }
          const markdown = formatDigestMarkdown(findings, execCtx.cycleNumber)
          execCtx.github.postComment(execCtx.digestIssue, markdown)
          return { success: true, message: 'Digest posted' }
        },
      })
    }

    // Create GitHub issues for critical findings
    const criticalFindings = findings.filter((f) => f.severity === 'critical')
    for (const finding of criticalFindings) {
      const dedupKey = `security-scanner:issue:${finding.file}:${finding.rule}`
      const searchQuery = `[Security] ${finding.message} in:${finding.file} in:title is:open label:${SECURITY_LABEL}`

      actions.push({
        plugin: 'security-scanner',
        type: 'create-issue',
        urgency: 'critical',
        title: `[Security] ${finding.message} in ${finding.file}`,
        detail: finding.detail,
        dedupKey,
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          // Check for existing open issue to avoid spam
          const existing = execCtx.github.searchIssues(searchQuery)
          if (existing.length > 0) {
            return {
              success: true,
              message: `Issue already exists (#${existing[0].number}) — skipping`,
            }
          }

          const body = formatIssueBody(finding)
          const issueNumber = execCtx.github.createIssue(
            `[Security] ${finding.message} in ${finding.file}`,
            body,
            [SECURITY_LABEL],
          )
          if (issueNumber) {
            return { success: true, message: `Created issue #${issueNumber}` }
          }
          return { success: false, message: 'Failed to create issue' }
        },
      })
    }

    return actions
  },
}

// ============================================================================
// Formatting helpers
// ============================================================================

function formatDigestSummary(
  findings: Array<{ severity: string; file: string; message: string }>,
): string {
  const critical = findings.filter((f) => f.severity === 'critical').length
  const high = findings.filter((f) => f.severity === 'high').length
  const medium = findings.filter((f) => f.severity === 'medium').length
  const low = findings.filter((f) => f.severity === 'low').length

  return `Security scan: ${findings.length} findings (${critical} critical, ${high} high, ${medium} medium, ${low} low)`
}

function formatDigestMarkdown(
  findings: Array<{
    severity: string
    file: string
    message: string
    detail: string
    line?: number
  }>,
  cycleNumber: number,
): string {
  const severityCounts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  }

  let markdown = `## 🔒 Security Scan Report — Cycle #${cycleNumber}\n\n`
  markdown += `| Severity | Count |\n|----------|-------|\n`
  markdown += `| 🔴 Critical | ${severityCounts.critical} |\n`
  markdown += `| 🟠 High | ${severityCounts.high} |\n`
  markdown += `| 🟡 Medium | ${severityCounts.medium} |\n`
  markdown += `| 🟢 Low | ${severityCounts.low} |\n\n`

  if (findings.length > 0) {
    markdown += `### Findings\n\n`
    markdown += `| Severity | File | Message |\n|----------|------|---------|\n`
    for (const f of findings.slice(0, 20)) {
      const severityIcon =
        f.severity === 'critical'
          ? '🔴'
          : f.severity === 'high'
            ? '🟠'
            : f.severity === 'medium'
              ? '🟡'
              : '🟢'
      markdown += `| ${severityIcon} ${f.severity} | \`${f.file}${f.line ? `:${f.line}` : ''}\` | ${f.message} |\n`
    }
    if (findings.length > 20) {
      markdown += `\n_... and ${findings.length - 20} more findings_\n`
    }
  }

  markdown += `\n_Generated by Security Scanner on ${new Date().toISOString()}_`

  return markdown
}

function formatIssueBody(finding: {
  file: string
  message: string
  detail: string
  line?: number
}): string {
  let body = `## Security Vulnerability\n\n`
  body += `**File:** \`${finding.file}${finding.line ? `:${finding.line}` : ''}\`\n\n`
  body += `**Issue:** ${finding.message}\n\n`
  body += `### Details\n\n`
  body += '```\n' + finding.detail + '\n```\n\n'
  body += `_Auto-generated by the Security Scanner inspector plugin on ${new Date().toISOString()}_`

  return body
}
