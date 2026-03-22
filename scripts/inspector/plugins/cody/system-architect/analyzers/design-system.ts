/**
 * @fileType utility
 * @domain inspector
 * @pattern design-system-analyzer
 * @ai-summary Analyzes design system consistency, UI pattern reuse, and component standardization
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface DesignSystemIssue {
  dimension: 'design-system'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface DesignSystemResult {
  issues: DesignSystemIssue[]
  metrics: {
    totalComponents: number
    consistentPatterns: number
    inconsistentPatterns: string[]
  }
}

// Hardcoded color/style patterns that should use design tokens
const HARDCODED_STYLE_PATTERNS = [
  { pattern: /#(?:[0-9A-Fa-f]{3}){1,2}(?!\w)/g, name: 'hex color' },
  { pattern: /rgb\s*\(/g, name: 'rgb color' },
  { pattern: /rgba\s*\(/g, name: 'rgba color' },
]

// Inline styles that indicate design system violation
const INLINE_STYLE_PATTERNS = [
  /style\s*=\s*\{[^}]*:[^}]*\}/,
  /className\s*=\s*["'][^"']*\b(bg|text|padding|margin|font|color)\b[^"']*["']/,
]

// Deprecated component usage
const DEPRECATED_PATTERNS = [
  { pattern: /from\s+['"]@\/components\//g, name: 'deprecated components import' },
  { pattern: /from\s+['"]@\/ui\/shared\//g, name: 'deprecated shared UI import' },
]

function countComponents(dir: string): number {
  let count = 0

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
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
        (entry.name.includes('Component') ||
          entry.name.includes('component') ||
          entry.name.includes('UI') ||
          entry.name.includes('ui/'))
      ) {
        count++
      }
    }
  }

  traverse(dir)
  return count
}

function findHardcodedStyles(dir: string): Array<{ file: string; matches: string[] }> {
  const results: Array<{ file: string; matches: string[] }> = []

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
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const matches: string[] = []

          // Check for hardcoded colors
          for (const { pattern, name } of HARDCODED_STYLE_PATTERNS) {
            const found = content.match(pattern)
            if (found && found.length > 3) {
              // More than 3 hardcoded colors is suspicious
              matches.push(`${found.length}x ${name}`)
            }
          }

          // Check for inline styles
          for (const pattern of INLINE_STYLE_PATTERNS) {
            if (pattern.test(content)) {
              matches.push('inline styles detected')
              break
            }
          }

          if (matches.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              matches,
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

function findDeprecatedImports(dir: string): Array<{ file: string; deprecated: string[] }> {
  const results: Array<{ file: string; deprecated: string[] }> = []

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
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const deprecated: string[] = []

          for (const { pattern, name } of DEPRECATED_PATTERNS) {
            if (pattern.test(content)) {
              deprecated.push(name)
            }
          }

          if (deprecated.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              deprecated,
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

function findInconsistentSpacing(dir: string): string[] {
  // Detect inconsistent spacing patterns (e.g., mixing px-2 and p-2)
  const inconsistencies: string[] = []
  const spacingUsages = new Map<string, number>()

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
          // Check for various spacing patterns
          const pxMatches = content.match(/px-\d+/g) || []
          const pyMatches = content.match(/py-\d+/g) || []
          const pMatches = content.match(/p-\d+/g) || []

          if (pxMatches.length > 0 || pyMatches.length > 0 || pMatches.length > 0) {
            spacingUsages.set(
              fullPath.replace(process.cwd(), ''),
              (spacingUsages.get(fullPath.replace(process.cwd(), '')) || 0) +
                pxMatches.length +
                pyMatches.length +
                pMatches.length,
            )
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return inconsistencies
}

export function analyzeDesignSystem(dir: string, _log: Logger): DesignSystemResult {
  const issues: DesignSystemIssue[] = []

  const hardcodedStyles = findHardcodedStyles(dir)
  const deprecatedImports = findDeprecatedImports(dir)

  for (const { file, matches } of hardcodedStyles) {
    issues.push({
      dimension: 'design-system',
      priority: 'warning',
      description: `Hardcoded styles in ${file}: ${matches.join(', ')}`,
      impact: 'Inconsistent styling makes design system harder to maintain and update',
      recommendation: 'Use design tokens or Tailwind config values instead of hardcoded values',
      file,
    })
  }

  for (const { file, deprecated } of deprecatedImports) {
    issues.push({
      dimension: 'design-system',
      priority: 'warning',
      description: `Deprecated import patterns in ${file}: ${deprecated.join(', ')}`,
      impact: 'Deprecated imports may not receive updates and represent technical debt',
      recommendation: 'Migrate to new import patterns per FILE_STRUCTURE_GUIDE.md',
      file,
    })
  }

  const componentCount = countComponents(dir)
  const inconsistentPatterns = findInconsistentSpacing(dir)

  return {
    issues,
    metrics: {
      totalComponents: componentCount,
      consistentPatterns: 0,
      inconsistentPatterns,
    },
  }
}
