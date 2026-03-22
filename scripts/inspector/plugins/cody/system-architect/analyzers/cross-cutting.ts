/**
 * @fileType utility
 * @domain inspector
 * @pattern cross-cutting-analyzer
 * @ai-summary Analyzes cross-cutting concerns — ripple effects, leaky abstractions, shared mutable state, scattered logic
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface CrossCuttingIssue {
  dimension: 'cross-cutting'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface CrossCuttingResult {
  issues: CrossCuttingIssue[]
  metrics: {
    leakyAbstractions: number
    rippleEffects: number
    sharedMutableState: number
    scatteredLogic: number
  }
}

// Patterns that indicate scattered/duplicated logic across files
const SCATTERED_LOGIC_PATTERNS = [
  { pattern: /TODO:.*same.*|DUPLICATE:.*|Copy.*of/gim, name: 'marked duplication comments' },
]

function findLeakyAbstractions(dir: string): Array<{ file: string; leaks: string[] }> {
  const results: Array<{ file: string; leaks: string[] }> = []

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
          const leaks: string[] = []

          // Check for console logging implementation details
          const consoleMatches = content.match(/console\.(log|debug)\s*\([^)]*\[.*\]/g) || []
          if (consoleMatches.length > 0) {
            leaks.push(`${consoleMatches.length}x console.log with array/object`)
          }

          if (leaks.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              leaks,
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

function findRippleEffectRisks(dir: string): Array<{ file: string; risks: string[] }> {
  const results: Array<{ file: string; risks: string[] }> = []

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
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const risks: string[] = []

          // Find large prop interfaces (20+ lines)
          const interfaceMatches = content.match(/interface\s+\w+Props\s*\{[\s\S]*?\n\}/g) || []
          for (const iface of interfaceMatches) {
            const lines = iface.split('\n').length
            if (lines > 20) {
              risks.push(`Large interface (${lines} lines)`)
            }
          }

          if (risks.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              risks,
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

function findSharedMutableState(dir: string): Array<{ file: string; state: string[] }> {
  const results: Array<{ file: string; state: string[] }> = []

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
          const state: string[] = []

          // Check for exported mutable state
          const exportedMutable = content.match(/export\s+(?:const|let)\s+\w+\s*=/g) || []
          if (exportedMutable.length > 0) {
            state.push(`${exportedMutable.length}x exported mutable state`)
          }

          // Check for global/window access
          const globalMatches = content.match(/(?:global|window)\.\w+/g) || []
          if (globalMatches.length > 0) {
            state.push(`${globalMatches.length}x global/window access`)
          }

          if (state.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              state,
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

function findScatteredLogic(dir: string): Array<{ file: string; patterns: string[] }> {
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

          for (const { pattern, name } of SCATTERED_LOGIC_PATTERNS) {
            if (pattern.test(content)) {
              patterns.push(name)
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

export function analyzeCrossCutting(dir: string, _log: Logger): CrossCuttingResult {
  const issues: CrossCuttingIssue[] = []

  const leakyAbstractions = findLeakyAbstractions(dir)
  const rippleEffectRisks = findRippleEffectRisks(dir)
  const sharedMutableState = findSharedMutableState(dir)
  const scatteredLogic = findScatteredLogic(dir)

  for (const { file, leaks } of leakyAbstractions) {
    issues.push({
      dimension: 'cross-cutting',
      priority: 'warning',
      description: `Leaky abstraction in ${file}: ${leaks.join(', ')}`,
      impact: 'Implementation details leaking through abstractions increase coupling',
      recommendation: 'Hide implementation details behind clean abstractions',
      file,
    })
  }

  for (const { file, risks } of rippleEffectRisks) {
    issues.push({
      dimension: 'cross-cutting',
      priority: 'info',
      description: `Ripple effect risk in ${file}: ${risks.join(', ')}`,
      impact: 'Large interfaces/types encourage changes that affect many consumers',
      recommendation: 'Break large interfaces into smaller, focused ones',
      file,
    })
  }

  for (const { file, state } of sharedMutableState) {
    issues.push({
      dimension: 'cross-cutting',
      priority: 'warning',
      description: `Shared mutable state in ${file}: ${state.join(', ')}`,
      impact: 'Shared mutable state creates unexpected coupling between modules',
      recommendation: 'Use immutable patterns or state management solutions',
      file,
    })
  }

  for (const { file, patterns } of scatteredLogic) {
    issues.push({
      dimension: 'cross-cutting',
      priority: 'warning',
      description: `Scattered logic marker in ${file}: ${patterns.join(', ')}`,
      impact: 'Marked duplication indicates known scattered logic that should be refactored',
      recommendation: 'Address the marked duplication by extracting shared logic',
      file,
    })
  }

  return {
    issues,
    metrics: {
      leakyAbstractions: leakyAbstractions.length,
      rippleEffects: rippleEffectRisks.length,
      sharedMutableState: sharedMutableState.length,
      scatteredLogic: scatteredLogic.length,
    },
  }
}
