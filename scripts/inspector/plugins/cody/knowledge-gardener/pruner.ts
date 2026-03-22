/**
 * @fileType utility
 * @domain inspector
 * @pattern knowledge-gardener-pruner
 * @ai-summary Manages knowledge base size cap and detects skill creation candidates
 */

import type { KnowledgeIndex, KnowledgeEntry } from './extractor'

/** Max entries to keep in the knowledge index */
export const MAX_ENTRIES = 100

/** Min pattern frequency to flag as a skill candidate */
export const SKILL_CANDIDATE_THRESHOLD = 3

export interface GardenResult {
  newEntries: KnowledgeEntry[]
  removedEntries: KnowledgeEntry[]
  skillCandidates: string[]
  updatedIndex: KnowledgeIndex
}

/**
 * Merge new entries into the knowledge index, enforce size cap,
 * update pattern frequencies, and detect skill candidates.
 */
export function cultivate(current: KnowledgeIndex, newEntries: KnowledgeEntry[]): GardenResult {
  if (newEntries.length === 0) {
    return {
      newEntries: [],
      removedEntries: [],
      skillCandidates: [],
      updatedIndex: current,
    }
  }

  // Merge new entries (deduplicate by taskId)
  const existingIds = new Set(current.entries.map((e) => e.taskId))
  const deduped = newEntries.filter((e) => !existingIds.has(e.taskId))

  const merged = [...current.entries, ...deduped]

  // Update pattern frequency
  const patternFrequency = { ...current.patternFrequency }
  for (const entry of deduped) {
    for (const pattern of entry.patterns) {
      patternFrequency[pattern] = (patternFrequency[pattern] ?? 0) + 1
    }
  }

  // Enforce size cap — remove oldest entries (by date) if over MAX_ENTRIES
  let removedEntries: KnowledgeEntry[] = []
  let pruned = merged

  if (merged.length > MAX_ENTRIES) {
    // Sort by date ascending — oldest first for removal
    const sorted = [...merged].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    const toRemove = sorted.slice(0, merged.length - MAX_ENTRIES)
    const toRemoveIds = new Set(toRemove.map((e) => e.taskId))
    removedEntries = toRemove
    pruned = merged.filter((e) => !toRemoveIds.has(e.taskId))

    // Decrement pattern frequency for removed entries
    for (const entry of toRemove) {
      for (const pattern of entry.patterns) {
        if (patternFrequency[pattern] !== undefined) {
          patternFrequency[pattern] = Math.max(0, patternFrequency[pattern] - 1)
          if (patternFrequency[pattern] === 0) {
            delete patternFrequency[pattern]
          }
        }
      }
    }
  }

  // Detect skill candidates — patterns at or above threshold, not yet a skill
  const skillCandidates: string[] = []
  for (const [pattern, freq] of Object.entries(patternFrequency)) {
    if (freq >= SKILL_CANDIDATE_THRESHOLD && !current.skillsCreated.includes(pattern)) {
      skillCandidates.push(pattern)
    }
  }

  const updatedIndex: KnowledgeIndex = {
    ...current,
    entries: pruned,
    patternFrequency,
    lastUpdated: new Date().toISOString(),
  }

  return {
    newEntries: deduped,
    removedEntries,
    skillCandidates,
    updatedIndex,
  }
}
