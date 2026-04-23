/**
 * Accent palette for dashboard widget cards.
 *
 * Payload's admin theme only defines 4 semantic colors (success/error/info/warning),
 * which isn't enough for distinct accent bars on 8+ cards. These constants centralize
 * the palette so colors aren't scattered as inline hex values throughout widget files.
 *
 * Prefer Payload theme variables (`var(--theme-success)`, etc.) for semantic meaning
 * (success/error/warning/info). Use these accent colors only for visual differentiation
 * between metric cards where semantic meaning doesn't apply.
 */

export const ACCENT = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
} as const

export type AccentKey = keyof typeof ACCENT

/**
 * Rotating palette for dynamic lists (e.g. course enrollment bars).
 */
export const CHART_PALETTE: readonly string[] = [
  ACCENT.indigo,
  ACCENT.blue,
  ACCENT.cyan,
  ACCENT.emerald,
  ACCENT.amber,
  ACCENT.red,
  ACCENT.violet,
] as const

/**
 * Returns a translucent (10% alpha) version of a hex color, for icon backgrounds.
 */
export function tint(hex: string, alpha = 0.1): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
