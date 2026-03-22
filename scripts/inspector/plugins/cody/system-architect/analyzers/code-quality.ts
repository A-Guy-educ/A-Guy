/**
 * @fileType utility
 * @domain inspector
 * @pattern code-quality-analyzer
 * @ai-summary Analyzes code quality — complexity, `any` types, magic numbers, long functions, error handling
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface CodeQualityIssue {
  dimension: 'code-quality'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface CodeQualityResult {
  issues: CodeQualityIssue[]
  metrics: {
    anyTypeCount: number
    magicNumberCount: number
    longFunctionCount: number
    missingErrorHandling: number
  }
}

function findAnyTypes(dir: string): Array<{ file: string; count: number }> {
  const results: Array<{ file: string; count: number }> = []

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
          // Count : any occurrences that are actual type annotations
          const anyMatches = content.match(/:\s*any\b/g) || []
          const asAnyMatches = content.match(/\bas\s+any\b/g) || []
          const totalAny = anyMatches.length + asAnyMatches.length

          if (totalAny > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              count: totalAny,
            })
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return results.sort((a, b) => b.count - a.count).slice(0, 10)
}

function findMagicNumbers(dir: string): Array<{ file: string; numbers: number[] }> {
  const results: Array<{ file: string; numbers: number[] }> = []

  // Patterns that look like magic numbers (but exclude common ones)
  const COMMON_NUMBERS = [0, 1, 2, 3, 4, 5, 10, 100, 1000, -1, -2]

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
          // Match standalone numbers that aren't in strings or comments
          const matches =
            content.match(/(?<![a-zA-Z_])(?<!\.\.\.)(?<!\d)\b(\d{2,})\b(?![xX0-9a-fA-F])/g) || []
          const nonCommon = matches
            .map((n) => parseInt(n, 10))
            .filter((n) => !COMMON_NUMBERS.includes(n) && n > 31)

          if (nonCommon.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              numbers: nonCommon.slice(0, 5),
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

function findLongFunctions(dir: string): Array<{ file: string; functions: string[] }> {
  const results: Array<{ file: string; functions: string[] }> = []

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
          const lines = content.split('\n')
          const longFunctions: string[] = []

          // Simple heuristic: find function declarations and count lines until next function or closing brace
          const functionPatterns = [
            /^export\s+(?:async\s+)?function\s+(\w+)/,
            /^(?:async\s+)?function\s+(\w+)/,
            /^\s*(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
          ]

          for (let i = 0; i < lines.length; i++) {
            for (const pattern of functionPatterns) {
              const match = lines[i].match(pattern)
              if (match) {
                const funcName = match[1]
                // Count lines until we find the closing brace (simplified)
                let braceCount = 0
                let lineCount = 0
                let j = i

                while (j < lines.length) {
                  const line = lines[j]
                  braceCount += (line.match(/\{/g) || []).length
                  braceCount -= (line.match(/\}/g) || []).length
                  lineCount++

                  if (braceCount === 0 && j > i) {
                    break
                  }
                  j++
                }

                if (lineCount > 50) {
                  longFunctions.push(`${funcName} (${lineCount} lines)`)
                }
              }
            }
          }

          if (longFunctions.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              functions: longFunctions.slice(0, 3),
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

function findMissingErrorHandling(dir: string): Array<{ file: string; locations: string[] }> {
  const results: Array<{ file: string; locations: string[] }> = []

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
          const locations: string[] = []

          // Find async functions without try/catch
          const asyncMatches = content.match(/\basync\s+/g) || []
          const tryCatchMatches = content.match(/try\s*\{/g) || []

          // Simple heuristic: if there are more async operations than try/catch blocks, flag it
          if (asyncMatches.length > tryCatchMatches.length + 2) {
            locations.push(
              `${asyncMatches.length} async operations, ${tryCatchMatches.length} try/catch blocks`,
            )
          }

          // Find .then() without catch
          const thenMatches = content.match(/\.then\(/g) || []
          const catchMatches = content.match(/\.catch\(/g) || []

          if (thenMatches.length > catchMatches.length) {
            locations.push(`${thenMatches.length - catchMatches.length} .then() without .catch()`)
          }

          if (locations.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              locations,
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

export function analyzeCodeQuality(dir: string, _log: Logger): CodeQualityResult {
  const issues: CodeQualityIssue[] = []

  const anyTypes = findAnyTypes(dir)
  const magicNumbers = findMagicNumbers(dir)
  const longFunctions = findLongFunctions(dir)
  const missingErrorHandling = findMissingErrorHandling(dir)

  for (const { file, count } of anyTypes) {
    issues.push({
      dimension: 'code-quality',
      priority: 'warning',
      description: `Excessive 'any' types in ${file}: ${count} occurrences`,
      impact: 'Using any bypasses TypeScript type checking, increasing runtime error risk',
      recommendation: 'Replace with proper types or unknown with type guards',
      file,
    })
  }

  for (const { file, numbers } of magicNumbers) {
    issues.push({
      dimension: 'code-quality',
      priority: 'info',
      description: `Magic numbers in ${file}: ${numbers.slice(0, 3).join(', ')}${numbers.length > 3 ? '...' : ''}`,
      impact: 'Magic numbers reduce code readability and make maintenance harder',
      recommendation: 'Extract to named constants with descriptive names',
      file,
    })
  }

  for (const { file, functions } of longFunctions) {
    issues.push({
      dimension: 'code-quality',
      priority: 'warning',
      description: `Long functions in ${file}: ${functions.join(', ')}`,
      impact: 'Long functions are harder to test, understand, and maintain',
      recommendation: 'Break into smaller, focused functions with single responsibilities',
      file,
    })
  }

  for (const { file, locations } of missingErrorHandling) {
    issues.push({
      dimension: 'code-quality',
      priority: 'warning',
      description: `Potential missing error handling in ${file}: ${locations.join('; ')}`,
      impact: 'Unhandled errors can cause silent failures or unhandled promise rejections',
      recommendation: 'Ensure all async operations have proper try/catch or .catch() handlers',
      file,
    })
  }

  return {
    issues,
    metrics: {
      anyTypeCount: anyTypes.reduce((acc, curr) => acc + curr.count, 0),
      magicNumberCount: magicNumbers.reduce((acc, curr) => acc + curr.numbers.length, 0),
      longFunctionCount: longFunctions.reduce((acc, curr) => acc + curr.functions.length, 0),
      missingErrorHandling: missingErrorHandling.length,
    },
  }
}
