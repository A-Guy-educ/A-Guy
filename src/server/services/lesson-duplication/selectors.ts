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
