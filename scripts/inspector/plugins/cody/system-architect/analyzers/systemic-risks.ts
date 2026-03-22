/**
 * @fileType utility
 * @domain inspector
 * @pattern systemic-risks-analyzer
 * @ai-summary Analyzes systemic risks — silent failures, hidden dependencies, unchecked assumptions, single points of failure
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface SystemicRiskIssue {
  dimension: 'systemic-risks'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface SystemicRiskResult {
  issues: SystemicRiskIssue[]
  metrics: {
    silentFailures: number
    hiddenDependencies: number
    uncheckedAssumptions: number
    singlePointsOfFailure: number
  }
}

// Patterns that indicate silent failures (empty catch blocks, swallowed errors)
const SILENT_FAILURE_PATTERNS = [
  { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g, name: 'empty catch block' },
  { pattern: /catch\s*\([^)]*\)\s*\{\s*\};?\s*$/gm, name: 'empty catch with no logging' },
]

// Patterns that indicate unchecked assumptions
const UNCHECKED_ASSUMPTION_PATTERNS = [
  { pattern: /\!\s*\w+\s*\?\./g, name: 'non-null assertion on optional chain result' },
  { pattern: /\w+\!\s*(?!\.)/g, name: 'non-null assertion without check' },
  { pattern: /as\s+\w+/g, name: 'type assertion without validation' },
]

// Single points of failure patterns
const SPOF_PATTERNS = [
  { pattern: /new\s+\w+Singleton/g, name: 'singleton instantiation' },
  { pattern: /getInstance\(\)/g, name: 'singleton getInstance pattern' },
]

function findSilentFailures(dir: string): Array<{ file: string; patterns: string[] }> {
  const results: Array<{ file: string; patterns: string[] }> = []

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const patterns: string[] = []

          for (const { pattern, name } of SILENT_FAILURE_PATTERNS) {
            if (pattern.test(content)) {
              patterns.push(name)
            }
          }

          // Also check for catch with only console.log/warn (no throw)
          const catchBlocks = content.match(/catch\s*\([^)]*\)\s*\{([^}]*)\}/g) || []
          for (const block of catchBlocks) {
            if (
              !block.includes('throw') &&
              !block.includes('reject') &&
              !block.includes('log.error')
            ) {
              // Only warn if there's no error propagation
              const blockBody = block.replace(/catch\s*\([^)]*\)\s*\{/, '').replace(/\}$/, '')
              if (blockBody.trim() && !blockBody.includes('//')) {
                patterns.push('catch with no error propagation')
                break
              }
            }
          }

          if (patterns.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              patterns,
            })
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return results
}

function findHiddenDependencies(dir: string): Array<{ file: string; deps: string[] }> {
  const results: Array<{ file: string; deps: string[] }> = []

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const deps: string[] = []

          // Find direct process.env access
          const envMatches = content.match(/process\.env\.\w+/g) || []
          const uniqueEnvVars = [...new Set(envMatches)]
          if (uniqueEnvVars.length > 5) {
            // More than 5 direct env accesses is suspicious
            deps.push(`${uniqueEnvVars.length} direct process.env accesses`)
          } else if (uniqueEnvVars.length > 0) {
            deps.push(...uniqueEnvVars.slice(0, 3))
          }

          if (deps.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              deps,
            })
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return results
}

function findUncheckedAssumptions(dir: string): Array<{ file: string; assumptions: string[] }> {
  const results: Array<{ file: string; assumptions: string[] }> = []

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const assumptions: string[] = []

          for (const { pattern, name } of UNCHECKED_ASSUMPTION_PATTERNS) {
            const matches = content.match(pattern) || []
            if (matches.length > 0) {
              assumptions.push(`${matches.length}x ${name}`)
            }
          }

          if (assumptions.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              assumptions,
            })
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return results
}

function findSinglePointsOfFailure(dir: string): Array<{ file: string; patterns: string[] }> {
  const results: Array<{ file: string; patterns: string[] }> = []

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const patterns: string[] = []

          for (const { pattern, name } of SPOF_PATTERNS) {
            if (pattern.test(content)) {
              patterns.push(name)
            }
          }

          // Check for direct instantiation without dependency injection
          const instantiations =
            content.match(/new\s+\w+(?!Error|Promise|Array|Object|String|Number|Boolean)/g) || []
          if (instantiations.length > 3) {
            patterns.push(`${instantiations.length} direct instantiations`)
          }

          if (patterns.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              patterns,
            })
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return results
}

export function analyzeSystemicRisks(dir: string, _log: Logger): SystemicRiskResult {
  const issues: SystemicRiskIssue[] = []

  const silentFailures = findSilentFailures(dir)
  const hiddenDependencies = findHiddenDependencies(dir)
  const uncheckedAssumptions = findUncheckedAssumptions(dir)
  const singlePointsOfFailure = findSinglePointsOfFailure(dir)

  for (const { file, patterns } of silentFailures) {
    issues.push({
      dimension: 'systemic-risks',
      priority: 'critical',
      description: `Silent failure in ${file}: ${patterns.join(', ')}`,
      impact: 'Silent failures hide errors and make debugging extremely difficult',
      recommendation: 'Ensure all catch blocks either propagate errors or log them properly',
      file,
    })
  }

  for (const { file, deps } of hiddenDependencies) {
    issues.push({
      dimension: 'systemic-risks',
      priority: 'warning',
      description: `Hidden dependency in ${file}: ${deps.join(', ')}`,
      impact: 'Direct environment access makes testing harder and creates implicit coupling',
      recommendation: 'Use a config module that abstracts environment access',
      file,
    })
  }

  for (const { file, assumptions } of uncheckedAssumptions) {
    issues.push({
      dimension: 'systemic-risks',
      priority: 'warning',
      description: `Unchecked assumptions in ${file}: ${assumptions.join(', ')}`,
      impact: 'Type assertions bypass TypeScript safety and can cause runtime errors',
      recommendation: 'Use proper type guards or validate before casting',
      file,
    })
  }

  for (const { file, patterns } of singlePointsOfFailure) {
    issues.push({
      dimension: 'systemic-risks',
      priority: 'info',
      description: `Potential single point of failure in ${file}: ${patterns.join(', ')}`,
      impact: 'Tight coupling and direct instantiation reduces testability and flexibility',
      recommendation: 'Consider dependency injection for better testability',
      file,
    })
  }

  return {
    issues,
    metrics: {
      silentFailures: silentFailures.length,
      hiddenDependencies: hiddenDependencies.length,
      uncheckedAssumptions: uncheckedAssumptions.length,
      singlePointsOfFailure: singlePointsOfFailure.length,
    },
  }
}
