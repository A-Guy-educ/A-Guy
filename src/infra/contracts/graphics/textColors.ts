/**
 * Color and size utilities for geometry elements.
 * Shared between admin editor and student renderer.
 *
 * All colors are read from the design system CSS variables (globals.css) at runtime.
 */

/** Convert an HSL string like "220 9% 11%" to a hex color */
function hslStringToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/)
  const h = parseFloat(parts[0])
  const s = parseFloat(parts[1]) / 100
  const l = parseFloat(parts[2]) / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const val = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * val)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Read a CSS variable from :root and convert its HSL value to hex */
export function cssVarToHex(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return hslStringToHex(value)
}

/** Palette definition referencing CSS variable names */
const PALETTE_VARS = [
  { label: 'Black', cssVar: '--foreground' },
  { label: 'Gray', cssVar: '--text-highlight-8' },
  { label: 'Red', cssVar: '--text-highlight-1' },
  { label: 'Orange', cssVar: '--text-highlight-2' },
  { label: 'Yellow', cssVar: '--text-highlight-3' },
  { label: 'Green', cssVar: '--text-highlight-4' },
  { label: 'Blue', cssVar: '--text-highlight-5' },
  { label: 'Purple', cssVar: '--text-highlight-6' },
  { label: 'Pink', cssVar: '--text-highlight-7' },
] as const

/** Color palette for text/point elements, resolved from CSS theme variables. */
export function getTextColorPalette(): ReadonlyArray<{ label: string; hex: string }> {
  return PALETTE_VARS.map(({ label, cssVar }) => ({
    label,
    hex: cssVarToHex(cssVar),
  }))
}

/** Default foreground color resolved from --foreground CSS variable */
export function getDefaultTextColor(): string {
  return cssVarToHex('--foreground')
}

/** Default angle color resolved from --text-highlight-5 (blue) CSS variable */
export function getDefaultAngleColor(): string {
  return cssVarToHex('--text-highlight-5')
}

/** Default canvas background resolved from --card CSS variable */
export function getDefaultCanvasBackground(): string {
  return cssVarToHex('--card')
}

/** Default shape fill resolved from --muted CSS variable */
export function getDefaultShapeFill(): string {
  return cssVarToHex('--muted')
}

/** Size scale (0-10) to pixel mapping */
const SIZE_SCALE_PX = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24] as const

/** Default size scale value */
export const DEFAULT_TEXT_SIZE_SCALE = 5

/**
 * Convert size scale (0-10) to pixel value.
 * @param scale - Size scale from 0 to 10
 * @returns Pixel value for fontSize
 */
export function sizeScaleToPixels(scale: number): number {
  return SIZE_SCALE_PX[Math.max(0, Math.min(10, scale))] ?? 14
}
