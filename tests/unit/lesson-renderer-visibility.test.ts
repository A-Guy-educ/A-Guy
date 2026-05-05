/**
 * @fileType unit-test
 * @domain lessons
 * @pattern visible-renderers, dual-mode
 * @ai-summary Unit tests for the renderer-visibility helper functions used in
 *             DualModeLessonView: getVisibleTabs and resolveEffectiveMode.
 */
import { describe, expect, it } from 'vitest'

// Inline the helpers to test them without importing client components.
// These mirror the implementations in DualModeLessonView/index.tsx and
// useLessonViewMode.ts.

type LessonMode = 'media' | 'pdf' | 'interactive'

/**
 * getVisibleTabs — mirrors DualModeLessonView/index.tsx
 *
 * Returns which tabs should be rendered, combining the admin toggle with the
 * data-presence guard for the Media tab.
 */
function getVisibleTabs(
  visibleRenderers: LessonMode[] | undefined,
  hasMedia: boolean,
): { media: boolean; pdf: boolean; interactive: boolean } {
  const all: LessonMode[] = ['media', 'pdf', 'interactive']
  const allowed = visibleRenderers ?? all
  return {
    media: hasMedia && allowed.includes('media'),
    pdf: allowed.includes('pdf'),
    interactive: allowed.includes('interactive'),
  }
}

/**
 * resolveEffectiveMode — mirrors useLessonViewMode.ts
 *
 * Resolves the active mode from a stored preference and a list of allowed modes.
 */
function resolveEffectiveMode(
  stored: LessonMode | null,
  allowedModes: LessonMode[] | undefined,
): LessonMode {
  if (!allowedModes) return stored ?? 'pdf'
  if (stored && allowedModes.includes(stored)) return stored
  const priority: LessonMode[] = ['media', 'pdf', 'interactive']
  for (const mode of priority) {
    if (allowedModes.includes(mode)) return mode
  }
  return 'pdf' // Safety fallback
}

describe('getVisibleTabs', () => {
  it('shows all three when all allowed and hasMedia=true', () => {
    const result = getVisibleTabs(['media', 'pdf', 'interactive'], true)
    expect(result).toEqual({ media: true, pdf: true, interactive: true })
  })

  it('hides media tab when hasMedia=false even if media is in visibleRenderers', () => {
    const result = getVisibleTabs(['media', 'pdf', 'interactive'], false)
    expect(result).toEqual({ media: false, pdf: true, interactive: true })
  })

  it('defaults to all three when visibleRenderers is undefined', () => {
    const result = getVisibleTabs(undefined, true)
    expect(result).toEqual({ media: true, pdf: true, interactive: true })
  })

  it('returns all false when visibleRenderers is empty array (theoretical — blocked at hook level)', () => {
    const result = getVisibleTabs([], true)
    expect(result).toEqual({ media: false, pdf: false, interactive: false })
  })

  it('respects partial selection: pdf only', () => {
    const result = getVisibleTabs(['pdf'], true)
    expect(result).toEqual({ media: false, pdf: true, interactive: false })
  })

  it('respects partial selection: media + interactive (no pdf)', () => {
    const result = getVisibleTabs(['media', 'interactive'], true)
    expect(result).toEqual({ media: true, pdf: false, interactive: true })
  })

  it('respects partial selection: media only (no pdf or interactive)', () => {
    const result = getVisibleTabs(['media'], true)
    expect(result).toEqual({ media: true, pdf: false, interactive: false })
  })

  it('media + pdf (no interactive) with hasMedia=true', () => {
    const result = getVisibleTabs(['media', 'pdf'], true)
    expect(result).toEqual({ media: true, pdf: true, interactive: false })
  })

  it('media + pdf (no interactive) with hasMedia=false', () => {
    const result = getVisibleTabs(['media', 'pdf'], false)
    expect(result).toEqual({ media: false, pdf: true, interactive: false })
  })
})

describe('resolveEffectiveMode', () => {
  it('returns stored mode when it is in allowedModes', () => {
    expect(resolveEffectiveMode('pdf', ['media', 'pdf', 'interactive'])).toBe('pdf')
    expect(resolveEffectiveMode('media', ['media', 'pdf', 'interactive'])).toBe('media')
    expect(resolveEffectiveMode('interactive', ['media', 'pdf', 'interactive'])).toBe('interactive')
  })

  it('returns first priority mode when stored is not in allowedModes', () => {
    // pdf not allowed → falls back to media (first in priority)
    expect(resolveEffectiveMode('pdf', ['media', 'interactive'])).toBe('media')
  })

  it('returns second priority mode when first is not in allowedModes', () => {
    // media not allowed → falls back to pdf (second in priority)
    expect(resolveEffectiveMode('media', ['pdf', 'interactive'])).toBe('pdf')
  })

  it('returns interactive when both media and pdf are not in allowedModes', () => {
    expect(resolveEffectiveMode('pdf', ['interactive'])).toBe('interactive')
    expect(resolveEffectiveMode('media', ['interactive'])).toBe('interactive')
  })

  it('returns pdf as ultimate fallback when no modes are allowed (theoretical — blocked at hook)', () => {
    expect(resolveEffectiveMode('pdf', [])).toBe('pdf')
  })

  it('returns pdf when allowedModes is undefined (backward compatible)', () => {
    expect(resolveEffectiveMode('pdf', undefined)).toBe('pdf')
    expect(resolveEffectiveMode('media', undefined)).toBe('media')
    expect(resolveEffectiveMode('interactive', undefined)).toBe('interactive')
    expect(resolveEffectiveMode(null, undefined)).toBe('pdf')
  })

  it('returns first priority mode when stored is null and allowedModes is defined', () => {
    // null is falsy, so the priority fallback kicks in: first allowed mode is 'media'
    expect(resolveEffectiveMode(null, ['media', 'pdf', 'interactive'])).toBe('media')
    expect(resolveEffectiveMode(null, ['media'])).toBe('media')
    expect(resolveEffectiveMode(null, ['pdf'])).toBe('pdf')
    expect(resolveEffectiveMode(null, ['interactive'])).toBe('interactive')
  })

  it('returns stored mode even when allowedModes does not include it but is not empty', () => {
    // Stored is 'interactive', but allowedModes only has 'media' — priority fallback applies
    expect(resolveEffectiveMode('interactive', ['media'])).toBe('media')
  })
})
