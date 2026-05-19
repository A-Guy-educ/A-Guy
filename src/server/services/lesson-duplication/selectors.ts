/**
 * Scaling-random selectors for the lesson duplication pipeline.
 *
 * "Scaling random" means: when the source list exceeds `max`, split it into
 * `max` contiguous buckets and pick one random item per bucket using a seeded
 * PRNG. This ensures the first picks are drawn from the head of the source and
 * the last picks from the tail, while still being reproducible per-call.
 *
 * - If items.length <= max: return all items unchanged (preserve order).
 * - If items.length >  max: bucket uniformly, pick one per bucket, sort by original index.
 * - No I/O. No Payload imports. Pure functions only.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (20 lines, zero dependencies)
// ---------------------------------------------------------------------------

/** Generate a deterministic [0,1) float from a 32-bit integer state. */
function nextFloat(state: [number]): number {
  let s = state[0]
  s |= 0
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  state[0] = s
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Advance the internal state (called once per pick to spread the seed). */
function rngStep(state: [number]): void {
  void nextFloat(state)
}

/** Return a seeded random integer in [start, end] inclusive. */
function seededIntBetween(state: [number], start: number, end: number): number {
  if (start === end) return start
  return start + Math.floor(nextFloat(state) * (end - start + 1))
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Internal scaling-random selector.
 *
 * @param items     Source array (read-only, never mutated)
 * @param max       Maximum number of items to return
 * @param seed      Optional seed for reproducibility; defaults to 42
 * @returns         Items from `items` that were selected, sorted by original index
 */
export function selectScaled<T>(items: T[], max: number, seed = 42): T[] {
  const n = items.length

  // Guard: invalid max → empty output
  if (max <= 0) return []

  // Guard: empty input → empty output
  if (n === 0) return []

  // Short-circuit: no selection needed, preserve order
  if (n <= max) return [...items] // spread to prevent mutation of source

  // Determine bucket boundaries using integer math.
  // bucket i covers indices [ floor(i * n / max), floor((i+1) * n / max) - 1 ].
  // Invariant: every index in [0, n-1] belongs to exactly one bucket.
  const picked: Array<{ item: T; index: number }> = []

  for (let i = 0; i < max; i++) {
    const bucketStart = Math.floor((i * n) / max)
    const bucketEnd = Math.floor(((i + 1) * n) / max) - 1

    // Initialise PRNG state per bucket using the shared seed plus bucket index.
    // This makes each bucket independent while still seeded/reproducible.
    const state: [number] = [(seed ^ (i * 2654435761 + 1)) >>> 0]

    const chosenIndex = seededIntBetween(state, bucketStart, bucketEnd)
    picked.push({ item: items[chosenIndex], index: chosenIndex })

    // Advance RNG so consecutive picks in the same bucket would differ
    rngStep(state)
  }

  // Sort by original source index to preserve source order in output
  return picked.sort((a, b) => a.index - b.index).map((p) => p.item)
}

// ---------------------------------------------------------------------------
// Public API (issue-specified signatures)
// ---------------------------------------------------------------------------

/**
 * Select at most 20 exercises from `items` using scaling-random selection.
 * See `selectScaled` for the algorithm details.
 *
 * @param items  Array of exercises (or any items)
 * @param max    Maximum count (default 20)
 * @param seed   Optional seed for reproducibility
 */
export function selectExercisesScaled<T>(items: T[], max = 20, seed?: number): T[] {
  return selectScaled(items, max, seed ?? 42)
}

/**
 * Select at most 5 sections from `items` using scaling-random selection.
 * Mirrors `selectExercisesScaled` with a default of 5.
 *
 * @param items  Array of sections/blocks (or any items)
 * @param max    Maximum count (default 5)
 * @param seed   Optional seed for reproducibility
 */
export function selectSectionsScaled<T>(items: T[], max = 5, seed?: number): T[] {
  return selectScaled(items, max, seed ?? 137)
}

// ---------------------------------------------------------------------------
// Block-type constants (shared with structural validator; must stay in sync)
// ---------------------------------------------------------------------------

/** All question block types — variation selector guarantees at least one. */
const QUESTION_TYPES = new Set([
  'question_select',
  'question_free_response',
  'question_table',
  'question_matching',
  'question_geometry',
  'question_axis',
  'question_multi_axis',
] as const)

/** Context block types — preferred as intro when they appear before questions. */
const CONTEXT_TYPES = new Set(['rich_text', 'latex'] as const)

/**
 * Type guard: true when `block` is a question block (guarantees at least one
 * question block will be selected by selectSectionsForVariation).
 */
function isQuestionBlock(block: { type: string }): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return QUESTION_TYPES.has(block.type as any)
}

/**
 * Type guard: true when `block` is a context block (rich_text or latex).
 * These are preferred as intro/header when they appear before question blocks.
 */
function isContextBlock(block: { type: string }): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return CONTEXT_TYPES.has(block.type as any)
}

// ---------------------------------------------------------------------------
// selectSectionsForVariation — variation-aware section selector
// ---------------------------------------------------------------------------

/**
 * Smart section selector for exercise variations.
 *
 * Unlike `selectSectionsScaled` (which picks evenly-spaced blocks by index),
 * this selector is aware of block semantics:
 *
 * - Always includes at least one `question_*` block (a variation without a
 *   question is useless).
 * - Prefers the first `rich_text`/`latex` block as intro/header when it
 *   appears before question blocks, then fills remaining slots with questions.
 * - If `blocks.length <= max`, returns all blocks unchanged (preserves order).
 * - If there are no question blocks (all-context exercise), returns the first
 *   `max` blocks in source order — the structural validator will fail it later.
 * - Source order is always preserved in the output array.
 *
 * Selection algorithm (when total > max):
 *   1. Identify whether a context block (rich_text/latex) appears before the
 *      first question block.
 *   2. If no context before questions: scale-select `max` blocks from the
 *      entire set (all questions → 5 questions; mixed → scaled mix).
 *   3. If context precedes questions: prepend the first context block, then
 *      scale-select `max-1` blocks from the question pool only
 *      (context[0] + 9 questions → 1 context + 4 questions).
 *   4. If no question blocks at all: return the first `max` context blocks
 *      in source order.
 *
 * The scaling within a pool uses the same seeded mulberry32 PRNG as
 * `selectScaled` so that identical inputs always produce identical outputs.
 *
 * @param blocks  Source content blocks. Each block must have a `type` field
 *                (string) identifying its kind.
 * @param max     Maximum number of blocks to return (default 5, matching the
 *                structural validator's TOO_MANY_SECTIONS cap)
 * @param seed    Optional seed for reproducibility; defaults to 137 (the same
 *                default used by selectSectionsScaled)
 */

export function selectSectionsForVariation<T extends { type: string }>(
  blocks: T[],
  max = 5,
  seed = 137,
): T[] {
  const n = blocks.length

  // Guard: invalid max → empty output
  if (max <= 0) return []

  // Guard: empty input → empty output
  if (n === 0) return []

  // Short-circuit: no selection needed, preserve order
  if (n <= max) return [...blocks]

  // Locate the first question block index and first context block index
  let firstQuestionIdx = -1
  let firstContextIdx = -1
  for (let i = 0; i < n; i++) {
    if (firstQuestionIdx === -1 && isQuestionBlock(blocks[i])) firstQuestionIdx = i
    if (firstContextIdx === -1 && isContextBlock(blocks[i])) firstContextIdx = i
    if (firstQuestionIdx !== -1 && firstContextIdx !== -1) break
  }

  // Case: no question blocks at all → return first max context blocks in order
  if (firstQuestionIdx === -1) {
    return blocks.slice(0, max)
  }

  // Case: context does NOT appear before the first question
  // (all-question exercise, or questions come first)
  if (firstContextIdx === -1 || firstContextIdx > firstQuestionIdx) {
    // Scale-select from the entire block set — context blocks that do exist
    // are treated as part of the question pool (scale distribution handles them)
    return selectScaled(blocks, max, seed)
  }

  // Case: context precedes the first question (mixed intro + questions shape)
  // Strategy: pin intro = blocks[0], scale-select (max-1) from question pool only.
  // This guarantees at least max-1 question blocks in the result.
  // The question pool is filtered from indices 1..n-1 to exclude the pinned intro.
  const questionPool = blocks.filter((_, i) => i >= 1 && isQuestionBlock(blocks[i]))
  const questionTail = selectScaled(questionPool, max - 1, seed)

  // Concatenate: first context block (intro) + scaled question tail.
  // Output is in source order because blocks[0] is index 0 (always lowest) and
  // selectScaled returns items sorted by their original index within questionPool.
  return [blocks[0], ...questionTail] as T[]
}
