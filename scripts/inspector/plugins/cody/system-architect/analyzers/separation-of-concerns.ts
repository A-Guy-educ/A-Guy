/**
 * @fileType utility
 * @domain inspector
 * @pattern separation-of-concerns-analyzer
 * @ai-summary Analyzes separation of concerns — business logic vs presentation, side effects in hooks, proper layering
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface SeparationIssue {
  dimension: 'separation-of-concerns'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface SeparationResult {
  issues: SeparationIssue[]
  metrics: {
    hooksWithSideEffects: number
    businessLogicInComponents: number
    presentationInHooks: number
  }
}

// Patterns that indicate business logic leakage into presentation
const BUSINESS_LOGIC_PATTERNS = [
  { pattern: /\.create\(.*collection:/g, name: 'payload.create in component' },
  { pattern: /\.update\(.*collection:/g, name: 'payload.update in component' },
  { pattern: /\.delete\(.*collection:/g, name: 'payload.delete in component' },
  { pattern: /\.find\(.*collection:/g, name: 'payload.find in component' },
]

// Patterns that indicate side effects in wrong places
const SIDE_EFFECT_PATTERNS = [
  { pattern: /useEffect.*\{[^}]*fetch\(/g, name: 'fetch in useEffect without deps' },
  { pattern: /useEffect.*\{[^}]*setTimeout/g, name: 'setTimeout in useEffect' },
  { pattern: /useEffect.*\{[^}]*localStorage/g, name: 'localStorage in useEffect' },
]

// Patterns that indicate presentation logic in hooks/services
const PRESENTATION_PATTERNS = [
  { pattern: /return.*<.*>/g, name: 'JSX return in non-component' },
  { pattern: /className\s*=/g, name: 'className styling in hook/service' },
]

function findBusinessLogicInComponents(dir: string): Array<{ file: string; patterns: string[] }> {
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
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const patterns: string[] = []

          // Skip if it's not a component (doesn't have export)
          if (
            !content.includes('export') &&
            !content.includes('function') &&
            !content.includes('const ') + ' = '
          ) {
            continue
          }

          for (const { pattern, name } of BUSINESS_LOGIC_PATTERNS) {
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

function findSideEffectsInHooks(dir: string): Array<{ file: string; effects: string[] }> {
  const results: Array<{ file: string; effects: string[] }> = []

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
        entry.name.endsWith('.ts') &&
        (fullPath.includes('/hooks/') || fullPath.includes('/use'))
      ) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const effects: string[] = []

          for (const { pattern, name } of SIDE_EFFECT_PATTERNS) {
            if (pattern.test(content)) {
              effects.push(name)
            }
          }

          if (effects.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              effects,
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

function findPresentationInServices(dir: string): Array<{ file: string; patterns: string[] }> {
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
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        (fullPath.includes('/services/') || fullPath.includes('/server/services'))
      ) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const patterns: string[] = []

          for (const { pattern, name } of PRESENTATION_PATTERNS) {
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

export function analyzeSeparationOfConcerns(srcDir: string, _log: Logger): SeparationResult {
  const issues: SeparationIssue[] = []

  const businessLogicInComponents = findBusinessLogicInComponents(srcDir)
  const sideEffectsInHooks = findSideEffectsInHooks(srcDir)
  const presentationInServices = findPresentationInServices(srcDir)

  for (const { file, patterns } of businessLogicInComponents) {
    issues.push({
      dimension: 'separation-of-concerns',
      priority: 'warning',
      description: `Business logic in component: ${file} contains ${patterns.join(', ')}`,
      impact: 'Mixing business logic with presentation makes components harder to test and reuse',
      recommendation: 'Move business logic to custom hooks or services',
      file,
    })
  }

  for (const { file, effects } of sideEffectsInHooks) {
    issues.push({
      dimension: 'separation-of-concerns',
      priority: 'warning',
      description: `Side effects in hook: ${file} contains ${effects.join(', ')}`,
      impact: 'Uncontrolled side effects can cause unpredictable behavior and memory leaks',
      recommendation: 'Ensure proper cleanup in useEffect and consider moving to custom hooks',
      file,
    })
  }

  for (const { file, patterns } of presentationInServices) {
    issues.push({
      dimension: 'separation-of-concerns',
      priority: 'warning',
      description: `Presentation logic in service: ${file} contains ${patterns.join(', ')}`,
      impact: 'Services should not know about presentation; this couples business logic to UI',
      recommendation:
        'Move presentation logic to components; keep services focused on business rules',
      file,
    })
  }

  return {
    issues,
    metrics: {
      hooksWithSideEffects: sideEffectsInHooks.length,
      businessLogicInComponents: businessLogicInComponents.length,
      presentationInHooks: presentationInServices.length,
    },
  }
}
