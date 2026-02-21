import { createHash } from 'crypto'

// ========== Text Hashing ==========

export function hashTextSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// ========== Deduplication Hashing ==========

export interface ExerciseInput {
  title: string
  blocks: Array<{
    blockType: string
    content?: string
    latex?: string
  }>
}

/**
 * Compute content hash for exercise deduplication
 */
export function computeContentHash(exercise: ExerciseInput): string {
  return createHash('sha256').update(normalizeForHash(exercise)).digest('hex')
}

function normalizeForHash(exercise: ExerciseInput): string {
  const title = exercise.title.trim().replace(/\s+/g, ' ')
  const blocks = exercise.blocks.map((b) => ({
    blockType: b.blockType,
    content:
      b.content
        ?.trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*([+\-*/=^_])\s*/g, '$1') || '',
    latex: b.latex,
  }))
  return canonicalStringify({ title, blocks })
}

/**
 * Canonical string representation for any input value.
 * Used for deterministic hashing across different JS runtimes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canonicalStringify(obj: any): string {
  if (obj === null) return 'null'
  if (obj === undefined) return 'undefined' // v2.2 Fix: Handle undefined values
  if (typeof obj === 'boolean') return String(obj)
  if (typeof obj === 'number') return JSON.stringify(obj)
  if (typeof obj === 'string') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']'
  if (typeof obj !== 'object') return JSON.stringify(obj) // v2.2 Fix: Handle other types
  const keys = Object.keys(obj).sort()
  const pairs = keys.map((k) => `${canonicalStringify(k)}:${canonicalStringify(obj[k])}`)
  return '{' + pairs.join(',') + '}'
}
