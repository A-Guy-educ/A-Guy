/**
 * @fileType plugin
 * @domain inspector
 * @pattern system-architect
 * @ai-summary Holistic system architecture analysis — layer boundaries, design system consistency, separation of concerns, code quality trends, systemic risks, cross-cutting concerns, and DRY enforcement
 */

import * as fs from 'fs'
import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import { analyzeArchitecture } from './analyzers/architecture'
import { analyzeDesignSystem } from './analyzers/design-system'
import { analyzeSeparationOfConcerns } from './analyzers/separation-of-concerns'
import { analyzeCodeQuality } from './analyzers/code-quality'
import { analyzeSystemicRisks } from './analyzers/systemic-risks'
import { analyzeCrossCutting } from './analyzers/cross-cutting'
import { analyzeCodeReuse } from './analyzers/code-reuse'
import { formatArchitectReport } from './formatter'

const DEDUP_WINDOW_MINUTES = 24 * 60 // 24 hours

export interface ArchitectFindings {
  architecture: ReturnType<typeof analyzeArchitecture>
  designSystem: ReturnType<typeof analyzeDesignSystem>
  separationOfConcerns: ReturnType<typeof analyzeSeparationOfConcerns>
  codeQuality: ReturnType<typeof analyzeCodeQuality>
  systemicRisks: ReturnType<typeof analyzeSystemicRisks>
  crossCutting: ReturnType<typeof analyzeCrossCutting>
  codeReuse: ReturnType<typeof analyzeCodeReuse>
}

export interface ArchitectReport {
  timestamp: string
  cycleNumber: number
  findings: ArchitectFindings
  summary: {
    totalIssues: number
    critical: number
    warning: number
    info: number
  }
  recommendations: Array<{
    dimension: string
    priority: 'critical' | 'warning' | 'info'
    issue: string
    impact: string
    action: string
  }>
}

/**
 * System Architect plugin — holistic code analysis across 7 dimensions.
 *
 * Runs ~daily (every 6th cycle + 24h dedup) to avoid noise while staying relevant.
 * Produces a prioritized architectural health report with actionable recommendations.
 */
export const systemArchitectPlugin: InspectorPlugin = {
  name: 'system-architect',
  description:
    'Holistic system architecture analysis — layer boundaries, design system, separation of concerns, code quality, systemic risks, cross-cutting concerns, and DRY enforcement',
  domain: 'cody',
  schedule: { every: 1 }, // Daily

  async run(ctx: InspectorContext): Promise<ActionRequest[]> {
    ctx.log.debug('Running system-architect plugin')

    const srcDir = path.resolve(process.cwd(), 'src')

    // Skip if src doesn't exist
    if (!fs.existsSync(srcDir)) {
      ctx.log.info('src/ not found — skipping system-architect')
      return []
    }

    // Run all analyzers
    const findings: ArchitectFindings = {
      architecture: analyzeArchitecture(srcDir, ctx.log),
      designSystem: analyzeDesignSystem(srcDir, ctx.log),
      separationOfConcerns: analyzeSeparationOfConcerns(srcDir, ctx.log),
      codeQuality: analyzeCodeQuality(srcDir, ctx.log),
      systemicRisks: analyzeSystemicRisks(srcDir, ctx.log),
      crossCutting: analyzeCrossCutting(srcDir, ctx.log),
      codeReuse: analyzeCodeReuse(srcDir, ctx.log),
    }

    // Count issues
    const allIssues = [
      ...findings.architecture.issues,
      ...findings.designSystem.issues,
      ...findings.separationOfConcerns.issues,
      ...findings.codeQuality.issues,
      ...findings.systemicRisks.issues,
      ...findings.crossCutting.issues,
      ...findings.codeReuse.issues,
    ]

    const summary = {
      totalIssues: allIssues.length,
      critical: allIssues.filter((i) => i.priority === 'critical').length,
      warning: allIssues.filter((i) => i.priority === 'warning').length,
      info: allIssues.filter((i) => i.priority === 'info').length,
    }

    // Build recommendations
    const recommendations = allIssues
      .filter((i) => i.priority !== 'info' || i.recommendation)
      .map((issue) => ({
        dimension: issue.dimension,
        priority: issue.priority,
        issue: issue.description,
        impact: issue.impact || 'Technical debt accumulating',
        action: issue.recommendation || 'Review and address',
      }))
      .slice(0, 10) // Top 10 recommendations

    const report: ArchitectReport = {
      timestamp: ctx.runTimestamp,
      cycleNumber: ctx.cycleNumber,
      findings,
      summary,
      recommendations,
    }

    ctx.log.info(
      {
        totalIssues: summary.totalIssues,
        critical: summary.critical,
        warning: summary.warning,
      },
      'System architect analysis complete',
    )

    const actions: ActionRequest[] = []

    // Digest issue action (only if there are critical/warning issues)
    if (ctx.digestIssue && summary.critical + summary.warning > 0) {
      actions.push({
        plugin: 'system-architect',
        type: 'architect-report',
        urgency: summary.critical > 0 ? 'warning' : 'info',
        title: `Architectural Health Report — ${summary.critical} critical, ${summary.warning} warnings`,
        detail: formatArchitectReport(report),
        dedupKey: 'system-architect:daily-report',
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          if (!execCtx.digestIssue) {
            return { success: false, message: 'Digest issue not configured' }
          }
          execCtx.github.postComment(execCtx.digestIssue, formatArchitectReport(report))
          return { success: true, message: 'Architectural report posted' }
        },
      })
    }

    return actions
  },
}
