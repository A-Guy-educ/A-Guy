/**
 * @fileType utility
 * @domain scripts
 * @pattern audit-history
 * @ai-summary Utility module for managing audit-history.json file to track improvements and effectiveness metrics
 */

import * as fs from 'fs'
import * as path from 'path'

// Paths
const TASKS_DIR = path.join(process.cwd(), '.tasks')
const AUDIT_HISTORY_FILE = path.join(TASKS_DIR, 'audit-history.json')

// Types
export interface Improvement {
  taskId: string
  date: string
  type: string
  title: string
  where: string
  status: 'applied' | 'suggested' | 'failed'
  followUpTaskIds: string[]
  effectiveness: 'effective' | 'neutral' | 'ineffective' | 'unknown'
}

export interface EffectivenessScores {
  effective: number
  neutral: number
  ineffective: number
  unknown: number
}

export interface Stats {
  totalImprovements: number
  appliedCount: number
  suggestedCount: number
  effectivenessScores: EffectivenessScores
  topCategories: Record<string, number>
}

export interface AuditHistory {
  version: number
  improvements: Improvement[]
  stats: Stats
  lastUpdated: string | null
}

/**
 * Reads and parses the audit-history.json file
 * @returns The parsed audit history object
 */
export function readAuditHistory(): AuditHistory {
  if (!fs.existsSync(AUDIT_HISTORY_FILE)) {
    throw new Error(`Audit history file not found: ${AUDIT_HISTORY_FILE}`)
  }

  const content = fs.readFileSync(AUDIT_HISTORY_FILE, 'utf-8')
  const parsed = JSON.parse(content)

  // Validate basic structure
  if (typeof parsed.version !== 'number') {
    throw new Error('Invalid audit history: missing or invalid version')
  }
  if (!Array.isArray(parsed.improvements)) {
    throw new Error('Invalid audit history: improvements must be an array')
  }
  if (typeof parsed.stats !== 'object' || parsed.stats === null) {
    throw new Error('Invalid audit history: stats must be an object')
  }

  return parsed as AuditHistory
}

/**
 * Adds a new improvement entry to the audit history
 * @param improvement - The improvement to add
 * @returns The updated audit history
 */
export function addImprovement(improvement: Omit<Improvement, 'date'>): AuditHistory {
  const history = readAuditHistory()

  const newImprovement: Improvement = {
    ...improvement,
    date: new Date().toISOString(),
  }

  history.improvements.push(newImprovement)
  history.lastUpdated = new Date().toISOString()

  // Update stats after adding improvement
  const updatedStats = calculateStats(history.improvements)
  history.stats = updatedStats

  fs.writeFileSync(AUDIT_HISTORY_FILE, JSON.stringify(history, null, 2))

  return history
}

/**
 * Recalculates stats from the improvements array
 * @returns The recalculated stats
 */
export function updateStats(): Stats {
  const history = readAuditHistory()
  const stats = calculateStats(history.improvements)
  history.stats = stats
  history.lastUpdated = new Date().toISOString()

  fs.writeFileSync(AUDIT_HISTORY_FILE, JSON.stringify(history, null, 2))

  return stats
}

/**
 * Calculates statistics from improvements array
 * @param improvements - Array of improvements
 * @returns Calculated stats
 */
function calculateStats(improvements: Improvement[]): Stats {
  const totalImprovements = improvements.length
  const appliedCount = improvements.filter((i) => i.status === 'applied').length
  const suggestedCount = improvements.filter((i) => i.status === 'suggested').length

  const effectivenessScores: EffectivenessScores = {
    effective: 0,
    neutral: 0,
    ineffective: 0,
    unknown: 0,
  }

  const topCategories: Record<string, number> = {}

  for (const improvement of improvements) {
    // Count effectiveness scores
    if (improvement.effectiveness in effectivenessScores) {
      effectivenessScores[improvement.effectiveness]++
    }

    // Count categories
    if (improvement.type) {
      topCategories[improvement.type] = (topCategories[improvement.type] || 0) + 1
    }
  }

  return {
    totalImprovements,
    appliedCount,
    suggestedCount,
    effectivenessScores,
    topCategories,
  }
}

/**
 * Gets the effectiveness score for a specific type/category
 * @param type - The improvement type to query
 * @returns Object with effectiveness metrics for that type, or null if not found
 */
export function getEffectivenessScore(type: string): {
  total: number
  effective: number
  neutral: number
  ineffective: number
  unknown: number
} | null {
  const history = readAuditHistory()

  const improvementsOfType = history.improvements.filter((i) => i.type === type)

  if (improvementsOfType.length === 0) {
    return null
  }

  const effective = improvementsOfType.filter((i) => i.effectiveness === 'effective').length
  const neutral = improvementsOfType.filter((i) => i.effectiveness === 'neutral').length
  const ineffective = improvementsOfType.filter((i) => i.effectiveness === 'ineffective').length
  const unknown = improvementsOfType.filter((i) => i.effectiveness === 'unknown').length

  return {
    total: improvementsOfType.length,
    effective,
    neutral,
    ineffective,
    unknown,
  }
}

/**
 * Gets all unique improvement types from the history
 * @returns Array of unique improvement types
 */
export function getImprovementTypes(): string[] {
  const history = readAuditHistory()
  const types = new Set<string>()

  for (const improvement of history.improvements) {
    if (improvement.type) {
      types.add(improvement.type)
    }
  }

  return Array.from(types)
}
