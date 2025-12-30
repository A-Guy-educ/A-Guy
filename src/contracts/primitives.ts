import { z } from 'zod'

/**
 * Shared primitive schemas for Exercise contracts
 */

/** Block identifier (uuid-like, but accept any non-empty string) */
export const BlockIdSchema = z.string().min(1)

/** Color string (flexible in v1, no strict regex) */
export const ColorStringSchema = z.string()

/** Position enum for labels, texts, and other positioned elements */
export const PositionEnumSchema = z.enum([
  't',
  'tr',
  'r',
  'br',
  'b',
  'bl',
  'l',
  'tl',
  'm',
  'middle',
])

/** Line style enum */
export const LineStyleSchema = z.enum(['solid', 'dashed', 'dotted'])

/** Inferred types */
export type BlockId = z.infer<typeof BlockIdSchema>
export type ColorString = z.infer<typeof ColorStringSchema>
export type PositionEnum = z.infer<typeof PositionEnumSchema>
export type LineStyle = z.infer<typeof LineStyleSchema>
