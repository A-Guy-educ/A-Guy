/**
 * Utilities for flat block list (no containers, no hierarchy)
 */

export const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'b-' + Math.random().toString(36).substr(2, 9)
}
