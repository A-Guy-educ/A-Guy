import { describe, expect, it } from 'vitest'
import {
  fixLatexEscapes,
  mergeExercisesAcrossPages,
  parseSchemaResponse,
  renderExercisesAsLatexText,
} from '@/server/services/lesson-context-conversion/structured-extraction'
import { parseContextText } from '@/lib/context-exercise-parser'

describe('mergeExercisesAcrossPages', () => {
  it('keeps original numbers when they are unique across pages', () => {
    const merged = mergeExercisesAcrossPages([
      {
        pageIndex: 0,
        exercises: [
          { number: 3, latex: 'x_1', solution: null },
          { number: 4, latex: 'x_2', solution: null },
        ],
      },
      {
        pageIndex: 1,
        exercises: [
          { number: 5, latex: 'x_3', solution: null },
          { number: 6, latex: 'x_4', solution: null },
        ],
      },
    ])

    expect(merged.map((e) => e.number)).toEqual([3, 4, 5, 6])
  })

  it('renumbers sequentially when pages collide on numbering', () => {
    // Each page processed independently can label its first exercise "1" —
    // when that produces duplicates we lose meaning, so renumber globally.
    const merged = mergeExercisesAcrossPages([
      {
        pageIndex: 0,
        exercises: [{ number: 1, latex: 'a', solution: null }],
      },
      {
        pageIndex: 1,
        exercises: [
          { number: 1, latex: 'b', solution: null },
          { number: 2, latex: 'c', solution: null },
        ],
      },
    ])

    expect(merged.map((e) => e.number)).toEqual([1, 2, 3])
    expect(merged.map((e) => e.latex)).toEqual(['a', 'b', 'c'])
  })

  it('respects page order when concatenating', () => {
    const merged = mergeExercisesAcrossPages([
      { pageIndex: 1, exercises: [{ number: 7, latex: 'late', solution: null }] },
      { pageIndex: 0, exercises: [{ number: 3, latex: 'early', solution: null }] },
    ])

    expect(merged.map((e) => e.latex)).toEqual(['early', 'late'])
  })

  it('returns empty array when no exercises were extracted', () => {
    const merged = mergeExercisesAcrossPages([
      { pageIndex: 0, exercises: [] },
      { pageIndex: 1, exercises: [] },
    ])
    expect(merged).toEqual([])
  })
})

describe('renderExercisesAsLatexText', () => {
  it('emits markers parseContextText recognises so the legacy viewer keeps working', () => {
    const text = renderExercisesAsLatexText([
      { number: 3, latex: 'התרגיל הראשון', solution: 'פתרון ראשון' },
      { number: 4, latex: 'התרגיל השני', solution: null },
    ])

    expect(text).toContain('\\textbf{תרגיל 3}')
    expect(text).toContain('\\textbf{תרגיל 4}')
    expect(text).toContain('\\section*{פתרונות}')
    expect(text).toContain('\\section*{פתרון תרגיל 3}')
    // Exercise 4 has no solution: a placeholder solution is emitted so the
    // legacy parser's phantom filter keeps the exercise in the preview.
    expect(text).toContain('\\section*{פתרון תרגיל 4}')

    // Round-trip: the legacy parser should split this into two exercises.
    const parsed = parseContextText(text)
    const exercises = parsed.flatMap((seg) => seg.exercises)
    expect(exercises).toHaveLength(2)
    expect(exercises[0].number).toBe(3)
    expect(exercises[1].number).toBe(4)
  })

  it('returns empty string for empty input', () => {
    expect(renderExercisesAsLatexText([])).toBe('')
  })

  it('emits placeholder solutions when none are provided so every exercise survives the legacy phantom filter', () => {
    const text = renderExercisesAsLatexText([
      { number: 1, latex: 'a', solution: null },
      { number: 2, latex: 'b', solution: null },
    ])
    // The legacy parser drops exercises lacking a matched solution when any
    // exercise has one. Emitting placeholder solutions keeps both visible.
    expect(text).toContain('\\section*{פתרון תרגיל 1}')
    expect(text).toContain('\\section*{פתרון תרגיל 2}')

    const exercises = parseContextText(text).flatMap((s) => s.exercises)
    expect(exercises).toHaveLength(2)
  })
})

describe('fixLatexEscapes', () => {
  it('rewrites lone LaTeX backslashes inside JSON string literals so JSON.parse succeeds', () => {
    // \i is not a valid JSON escape — JSON.parse fails on this literally.
    // After repair, the backslash becomes \\i which decodes to a single \i.
    const broken = '{"latex": "\\implies"}'
    expect(() => JSON.parse(broken)).toThrow()
    const fixed = fixLatexEscapes(broken)
    expect(JSON.parse(fixed)).toEqual({ latex: '\\implies' })
  })

  it('preserves valid JSON escape sequences inside strings', () => {
    // \" \\ \/ \b \f \n \r \t — all must pass through untouched.
    const valid = '{"a": "line\\nbreak", "b": "quote\\"end", "c": "slash\\\\path"}'
    expect(fixLatexEscapes(valid)).toBe(valid)
    expect(JSON.parse(fixLatexEscapes(valid))).toEqual({
      a: 'line\nbreak',
      b: 'quote"end',
      c: 'slash\\path',
    })
  })

  it('leaves structural JSON characters alone', () => {
    // The previous regex-based version applied the fix to the entire JSON
    // including structural positions. Confirm braces/commas/colons/numbers
    // are untouched and the rewriter is no-op on already-valid JSON.
    const json = '{"n": 42, "arr": [1, 2, 3]}'
    expect(fixLatexEscapes(json)).toBe(json)
  })

  it('does not exit a string region on an embedded escaped quote', () => {
    // The walker tracks escape state — a \" inside a string must not be
    // treated as the closing quote, otherwise the fix would start applying
    // to the surrounding structure. Use \i (invalid JSON escape) to trigger
    // the rewrite specifically inside the string region.
    const broken = '{"latex": "\\implies \\"yes\\""}'
    expect(() => JSON.parse(broken)).toThrow()
    expect(JSON.parse(fixLatexEscapes(broken))).toEqual({ latex: '\\implies "yes"' })
  })

  it('parseSchemaResponse falls back to fixLatexEscapes when first parse fails', () => {
    // Round-trip: code-fence stripping + escape repair on a Gemini-style
    // response with a raw \implies inside the latex field.
    const response =
      '```json\n{"exercises": [{"number": 1, "latex": "\\implies a", "solution": null}]}\n```'
    const parsed = parseSchemaResponse(response) as {
      exercises: Array<{ number: number; latex: string; solution: null }>
    }
    expect(parsed.exercises).toEqual([{ number: 1, latex: '\\implies a', solution: null }])
  })
})
