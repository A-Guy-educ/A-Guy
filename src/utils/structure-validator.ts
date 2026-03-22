/**
 * Structure Invariance Validator - Pure Validation Logic
 *
 * This module contains only pure validation functions that can be used
 * from both client and server code. No external dependencies.
 */

// Reserved metadata fields that must not be changed
const RESERVED_FIELDS = ['id', 'type', 'blockType', 'variant']

// Prototype pollution keys to reject
const PROTOTYPE_POLLUTION_KEYS = ['__proto__', 'prototype', 'constructor']

export interface StructureValidationError {
  path: string
  message: string
  type: 'key_added' | 'key_removed' | 'array_length' | 'metadata_changed' | 'type_changed'
}

export interface StructureValidationResult {
  valid: boolean
  errors: StructureValidationError[]
}

/**
 * Validates structural invariance between original and edited JSON.
 * Returns errors if structure has changed (keys added/removed, array length changes, metadata changed).
 */
export function validateStructuralInvariance(
  original: unknown,
  edited: unknown,
): StructureValidationResult {
  const errors: StructureValidationError[] = []

  // Handle null/undefined cases
  if (original === null || original === undefined) {
    if (edited !== null && edited !== undefined) {
      errors.push({
        path: '',
        message: 'Original is null/undefined but edited is not',
        type: 'type_changed',
      })
    }
    return { valid: errors.length === 0, errors }
  }

  if (edited === null || edited === undefined) {
    errors.push({
      path: '',
      message: 'Edited value is null/undefined',
      type: 'type_changed',
    })
    return { valid: errors.length === 0, errors }
  }

  const originalType = typeof original
  const editedType = typeof edited

  // Check type changes
  if (originalType !== editedType) {
    errors.push({
      path: '',
      message: `Type changed from ${originalType} to ${editedType}`,
      type: 'type_changed',
    })
    return { valid: false, errors }
  }

  // Handle arrays
  if (Array.isArray(original) && Array.isArray(edited)) {
    // Check array length
    if (original.length !== edited.length) {
      errors.push({
        path: '',
        message: `Array length changed from ${original.length} to ${edited.length}`,
        type: 'array_length',
      })
      // Don't return early - check individual elements too
    }

    // Check each element
    const maxLength = Math.max(original.length, edited.length)
    for (let i = 0; i < maxLength; i++) {
      const elementPath = `[${i}]`
      const elementErrors = validateStructuralInvariance(original[i], edited[i])
      // Remap paths for array elements
      errors.push(
        ...elementErrors.errors.map((e) => ({
          ...e,
          path: elementPath + (e.path ? '.' + e.path : ''),
        })),
      )
    }

    return { valid: errors.length === 0, errors }
  }

  // Handle objects
  if (originalType === 'object' && !Array.isArray(original) && !Array.isArray(edited)) {
    const origObj = original as Record<string, unknown>
    const editObj = edited as Record<string, unknown>

    const originalKeys = new Set(Object.keys(origObj))
    const editedKeys = new Set(Object.keys(editObj))

    // Check for added keys
    for (const key of editedKeys) {
      if (!originalKeys.has(key)) {
        // Check for prototype pollution
        if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
          errors.push({
            path: key,
            message: 'Prototype pollution key not allowed',
            type: 'key_added',
          })
        } else {
          errors.push({
            path: key,
            message: `Key "${key}" was added`,
            type: 'key_added',
          })
        }
      }
    }

    // Check for removed keys
    for (const key of originalKeys) {
      if (!editedKeys.has(key)) {
        errors.push({
          path: key,
          message: `Key "${key}" was removed`,
          type: 'key_removed',
        })
      }
    }

    // Check for reserved field changes (metadata)
    for (const key of originalKeys) {
      if (RESERVED_FIELDS.includes(key)) {
        if (origObj[key] !== editObj[key]) {
          errors.push({
            path: key,
            message: `Reserved field "${key}" cannot be changed`,
            type: 'metadata_changed',
          })
        }
      }
    }

    // Recursively check common keys
    for (const key of originalKeys) {
      if (editedKeys.has(key) && !RESERVED_FIELDS.includes(key)) {
        const nestedErrors = validateStructuralInvariance(origObj[key], editObj[key])
        // Remap paths for nested properties
        errors.push(
          ...nestedErrors.errors.map((e) => ({
            ...e,
            path: e.path ? `${key}.${e.path}` : key,
          })),
        )
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // Primitive types - no structure to validate
  return { valid: true, errors: [] }
}

/**
 * Sanitizes an object by removing prototype pollution keys.
 * Returns a new object without modifying the original.
 */
export function sanitizePrototypePollution<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizePrototypePollution(item)) as T
  }

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj as object)) {
    if (!PROTOTYPE_POLLUTION_KEYS.includes(key)) {
      result[key] = sanitizePrototypePollution((obj as Record<string, unknown>)[key])
    }
  }

  return result as T
}
