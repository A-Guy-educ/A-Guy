// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Reference resolver - resolves $ref references in step inputs
 * @fileType utility
 * @domain qa
 * @pattern ref-resolver
 */
import type { ActionRef } from '../actions/types'

type Refs = Record<string, ActionRef>

/**
 * Resolves $ref references in an object
 * e.g., { courseRef: "$course" } -> { courseRef: { id: "...", slug: "..." } }
 */
export function resolveRefs<T>(input: T, refs: Refs): T {
  if (input === null || input === undefined) {
    return input
  }

  if (typeof input === 'string') {
    // Check if it's a ref
    if (input.startsWith('$')) {
      const refName = input.slice(1)
      const ref = refs[refName]
      if (!ref) {
        throw new Error(`Reference "${input}" not found`)
      }
      return ref as unknown as T
    }
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveRefs(item, refs)) as T
  }

  if (typeof input === 'object') {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      resolved[key] = resolveRefs(value, refs)
    }
    return resolved as T
  }

  return input
}

/**
 * Extracts the actual value from a ref or returns the value as-is
 * Used when passing data to Payload API
 */
export function extractRefValue(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    // Extract ref name but don't use it - ref should be resolved before this is called
    void value.slice(1)
    // Return the string reference - will be resolved later
    return value
  }
  return value
}
