/**
 * Mapping rules for Nightly Docs Agent
 *
 * Matches structural files to documentation targets.
 */

import path from 'node:path'
import type { MappingRule } from './config-parser'
import { getFileDiff } from './delta'

// ============================================================================
// Types
// ============================================================================

export interface StructuralFile {
  path: string
  status: 'add' | 'modify' | 'delete' | 'rename'
  category: string
  impact: string
}

export interface MappingMatch {
  trigger: StructuralFile
  target: {
    doc: string
    section: string
  }
  action: 'update_list' | 'flag_review'
  evidence: string
}

export interface DocChange {
  doc: string
  section: string
  actions: MappingMatch[]
  combinedEvidence: string[]
}

// ============================================================================
// Glob Matching
// ============================================================================

function matchGlob(filePath: string, glob: string): boolean {
  // Convert glob to regex
  const regexStr = glob
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\./g, '\\.')

  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(filePath)
}

// ============================================================================
// Content Pattern Matching
// ============================================================================

function matchesContentPatterns(diff: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'm')
    if (regex.test(diff)) {
      return true
    }
  }
  return false
}

// ============================================================================
// Evidence Template Interpolation
// ============================================================================

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }

  return result.trim()
}

// ============================================================================
// Mapping Application
// ============================================================================

/**
 * Apply mapping rules to structural files
 */
export function applyMappings(
  files: StructuralFile[],
  rules: MappingRule[],
  baseCommit?: string,
): MappingMatch[] {
  const matches: MappingMatch[] = []

  for (const file of files) {
    for (const rule of rules) {
      // Check glob match
      if (!matchGlob(file.path, rule.trigger.glob)) {
        continue
      }

      // Check event match
      if (!rule.trigger.event.includes(file.status)) {
        continue
      }

      // Check content patterns (for modify events)
      if (file.status === 'modify' && rule.trigger.contentPatterns) {
        const diff = getFileDiff(file.path, baseCommit || 'HEAD~1')
        if (!matchesContentPatterns(diff, rule.trigger.contentPatterns)) {
          continue
        }
      }

      // Build evidence
      const evidence = interpolateTemplate(rule.evidenceTemplate, {
        action: file.status,
        filename: path.basename(file.path),
        path: file.path,
        dirname: path.basename(path.dirname(file.path)),
      })

      matches.push({
        trigger: file,
        target: rule.target,
        action: rule.action,
        evidence,
      })
    }
  }

  return matches
}

/**
 * Deduplicate matches by doc/section
 */
export function deduplicateChanges(matches: MappingMatch[]): DocChange[] {
  const byDocSection = new Map<string, MappingMatch[]>()

  for (const match of matches) {
    const key = `${match.target.doc}::${match.target.section}`
    if (!byDocSection.has(key)) {
      byDocSection.set(key, [])
    }
    byDocSection.get(key)!.push(match)
  }

  return Array.from(byDocSection.entries()).map(([key, actions]) => {
    const [doc, section] = key.split('::')
    return {
      doc,
      section,
      actions,
      combinedEvidence: actions.map((a) => a.evidence),
    }
  })
}
