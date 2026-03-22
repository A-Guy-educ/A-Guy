import { describe, it, expect } from 'vitest'

import { systemArchitectPlugin } from '../../../../scripts/inspector/plugins/cody/system-architect/index'
import { formatArchitectReport } from '../../../../scripts/inspector/plugins/cody/system-architect/formatter'

// ============================================================================
// Plugin Structure
// ============================================================================

describe('systemArchitectPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has correct plugin metadata', () => {
    expect(systemArchitectPlugin.name).toBe('system-architect')
    expect(systemArchitectPlugin.domain).toBe('cody')
    expect(systemArchitectPlugin.description).toContain('Holistic')
    expect(typeof systemArchitectPlugin.run).toBe('function')
  })

  it('has daily schedule', () => {
    expect(systemArchitectPlugin.schedule?.every).toBe(1)
  })

  // Note: Tests that run the plugin against the real codebase are skipped
  // because they scan the entire src/ directory and are slow.
  // The plugin is tested via integration tests in CI.
})

// ============================================================================
// Formatter
// ============================================================================

describe('formatArchitectReport', () => {
  it('produces valid markdown', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReport: any = {
      timestamp: new Date().toISOString(),
      cycleNumber: 42,
      findings: {
        architecture: { issues: [], metrics: {} },
        designSystem: { issues: [], metrics: {} },
        separationOfConcerns: { issues: [], metrics: {} },
        codeQuality: { issues: [], metrics: {} },
        systemicRisks: { issues: [], metrics: {} },
        crossCutting: { issues: [], metrics: {} },
        codeReuse: { issues: [], metrics: {} },
      },
      summary: {
        totalIssues: 0,
        critical: 0,
        warning: 0,
        info: 0,
      },
      recommendations: [],
    }

    const markdown = formatArchitectReport(mockReport)

    expect(markdown).toContain('Architectural Health Report')
    expect(markdown).toContain('Cycle #42')
    expect(markdown).toContain('Summary')
    expect(markdown).toContain('Total Issues')
  })

  it('includes top recommendations', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReport: any = {
      timestamp: new Date().toISOString(),
      cycleNumber: 1,
      findings: {
        architecture: {
          issues: [
            {
              dimension: 'architecture' as const,
              priority: 'critical' as const,
              description: 'Circular dependency detected',
              impact: 'Increases coupling',
              recommendation: 'Refactor to break cycle',
            },
          ],
          metrics: {},
        },
        designSystem: { issues: [], metrics: {} },
        separationOfConcerns: { issues: [], metrics: {} },
        codeQuality: { issues: [], metrics: {} },
        systemicRisks: { issues: [], metrics: {} },
        crossCutting: { issues: [], metrics: {} },
        codeReuse: { issues: [], metrics: {} },
      },
      summary: {
        totalIssues: 1,
        critical: 1,
        warning: 0,
        info: 0,
      },
      recommendations: [
        {
          dimension: 'architecture',
          priority: 'critical' as const,
          issue: 'Circular dependency detected',
          impact: 'Increases coupling',
          action: 'Refactor to break cycle',
        },
      ],
    }

    const markdown = formatArchitectReport(mockReport)

    expect(markdown).toContain('Top Recommendations')
    expect(markdown).toContain('Circular dependency detected')
    expect(markdown).toContain('🔴') // critical icon
  })

  it('includes detailed findings by dimension', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReport: any = {
      timestamp: new Date().toISOString(),
      cycleNumber: 1,
      findings: {
        architecture: {
          issues: [
            {
              dimension: 'architecture' as const,
              priority: 'warning' as const,
              description: 'Layer boundary violation',
            },
          ],
          metrics: {},
        },
        designSystem: { issues: [], metrics: {} },
        separationOfConcerns: { issues: [], metrics: {} },
        codeQuality: { issues: [], metrics: {} },
        systemicRisks: { issues: [], metrics: {} },
        crossCutting: { issues: [], metrics: {} },
        codeReuse: { issues: [], metrics: {} },
      },
      summary: {
        totalIssues: 1,
        critical: 0,
        warning: 1,
        info: 0,
      },
      recommendations: [],
    }

    const markdown = formatArchitectReport(mockReport)

    expect(markdown).toContain('Detailed Findings')
    expect(markdown).toContain('Architecture')
    expect(markdown).toContain('Layer boundary violation')
  })

  it('handles empty findings gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReport: any = {
      timestamp: new Date().toISOString(),
      cycleNumber: 1,
      findings: {
        architecture: { issues: [], metrics: {} },
        designSystem: { issues: [], metrics: {} },
        separationOfConcerns: { issues: [], metrics: {} },
        codeQuality: { issues: [], metrics: {} },
        systemicRisks: { issues: [], metrics: {} },
        crossCutting: { issues: [], metrics: {} },
        codeReuse: { issues: [], metrics: {} },
      },
      summary: {
        totalIssues: 0,
        critical: 0,
        warning: 0,
        info: 0,
      },
      recommendations: [],
    }

    const markdown = formatArchitectReport(mockReport)

    expect(markdown).toContain('0')
    expect(markdown).toContain('Summary')
    // Should not throw
  })
})
