/**
 * @fileType utility
 * @domain inspector
 * @pattern knowledge-gardener-extractor
 * @ai-summary Reads memory.json files from completed tasks and extracts knowledge entries
 */

import * as fs from 'fs'
import * as path from 'path'

/** Shape of a memory.json file written by the docs agent */
export interface MemoryJson {
  taskId: string
  date: string
  summary: string
  domain?: string
  taskType?: string
  patterns?: string[]
  filesChanged?: string[]
  gotchas?: string[]
  reusableCode?: string[]
}

/** Shape of a single knowledge base entry */
export interface KnowledgeEntry {
  taskId: string
  date: string
  domain: string
  taskType: string
  complexity: number
  patterns: string[]
  summary: string
}

/** Schema of .ai-docs/knowledge/index.json */
export interface KnowledgeIndex {
  version: number
  description: string
  entries: KnowledgeEntry[]
  patternFrequency: Record<string, number>
  skillsCreated: string[]
  lastUpdated: string
}

function createDefaultKnowledgeIndex(): KnowledgeIndex {
  return {
    version: 1,
    description:
      'Cross-task knowledge base for Cody pipeline self-learning. Updated by the Knowledge Gardener nightly inspector plugin.',
    entries: [],
    patternFrequency: {},
    skillsCreated: [],
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Parse a memory.json file content into a KnowledgeEntry.
 * Returns null if the file is invalid or missing required fields.
 */
export function parseMemoryJson(raw: string): MemoryJson | null {
  try {
    const parsed = JSON.parse(raw) as MemoryJson
    if (!parsed.taskId || !parsed.summary) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Convert a MemoryJson into a KnowledgeEntry.
 * Complexity is derived from filesChanged count (proxy metric).
 */
export function toKnowledgeEntry(mem: MemoryJson): KnowledgeEntry {
  const complexity = mem.filesChanged?.length ?? 0
  return {
    taskId: mem.taskId,
    date: mem.date ?? new Date().toISOString(),
    domain: mem.domain ?? 'unknown',
    taskType: mem.taskType ?? 'unknown',
    complexity,
    patterns: mem.patterns ?? [],
    summary: mem.summary,
  }
}

/**
 * Scan the tasks directory for new memory.json files not yet in the knowledge index.
 */
export function findNewMemoryFiles(tasksDir: string, existingTaskIds: Set<string>): MemoryJson[] {
  if (!fs.existsSync(tasksDir)) return []

  const entries = fs.readdirSync(tasksDir, { withFileTypes: true })
  const results: MemoryJson[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === '_archive') continue
    if (entry.name.startsWith('.')) continue

    // Skip tasks already in the knowledge base
    if (existingTaskIds.has(entry.name)) continue

    const memoryPath = path.join(tasksDir, entry.name, 'memory.json')
    if (!fs.existsSync(memoryPath)) continue

    let raw: string
    try {
      raw = fs.readFileSync(memoryPath, 'utf-8')
    } catch {
      continue
    }

    const mem = parseMemoryJson(raw)
    if (mem) results.push(mem)
  }

  return results
}

/**
 * Read the current knowledge index from disk.
 * Returns a fresh default if the file doesn't exist or is invalid.
 */
export function readKnowledgeIndex(indexPath: string): KnowledgeIndex {
  if (!fs.existsSync(indexPath)) return createDefaultKnowledgeIndex()

  try {
    const raw = fs.readFileSync(indexPath, 'utf-8')
    const parsed = JSON.parse(raw) as KnowledgeIndex
    // Ensure all required fields exist
    return {
      ...createDefaultKnowledgeIndex(),
      ...parsed,
      entries: parsed.entries ?? [],
      patternFrequency: parsed.patternFrequency ?? {},
      skillsCreated: parsed.skillsCreated ?? [],
    }
  } catch {
    return createDefaultKnowledgeIndex()
  }
}
