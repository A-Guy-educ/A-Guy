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
        .replace(/\s*([+\-*/=^_])\s*/g, '$1')
        .replace(/\s+/g, ' ') || '',
    latex: b.latex,
  }))
  return canonicalStringify({ title, blocks })
}

export function canonicalStringify(obj: any): string {
  if (obj === null) return 'null'
  if (typeof obj === 'boolean') return String(obj)
  if (typeof obj === 'number') return JSON.stringify(obj)
  if (typeof obj === 'string') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  const pairs = keys.map((k) => `${canonicalStringify(k)}:${canonicalStringify(obj[k])}`)
  return '{' + pairs.join(',') + '}'
}
