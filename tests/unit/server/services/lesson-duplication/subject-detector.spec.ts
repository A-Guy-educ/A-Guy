/**
 * Unit tests for src/server/services/lesson-duplication/subject-detector.ts
 *
 * Target: detectLessonSubject() — pure function, no mocks, no I/O, no Payload imports.
 * The function should detect the subject type based on chapter/course titles.
 *
 * Bug: The function does not exist yet (issue #1550).
 * These tests assert the expected behavior — they FAIL until the feature is implemented.
 */
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Type definitions (matching the expected function signature)
// ---------------------------------------------------------------------------

interface LessonStub {
  title: string
}

interface ChapterStub {
  title: string
}

interface CourseStub {
  title: string
}

// ---------------------------------------------------------------------------
// Helper to lazily import the module (fails if not implemented yet)
// ---------------------------------------------------------------------------

async function getDetectLessonSubject() {
  try {
    const mod = await import('@/server/services/lesson-duplication/subject-detector')
    return mod.detectLessonSubject
  } catch {
    // Module doesn't exist yet — this is the bug
    return null
  }
}

// ---------------------------------------------------------------------------
// Geometry detection — Hebrew + English keywords
// ---------------------------------------------------------------------------

describe('detectLessonSubject — geometry detection', () => {
  const geometryCases: Array<[string, { lesson?: string; chapter?: string; course?: string }]> = [
    // Hebrew keywords
    ['גיאומטריה בסיסית', { chapter: 'פרק גיאומטריה' }],
    ['משולשים וזוויות', { chapter: 'פרק משולש' }],
    ['שטח מעגל', { chapter: 'מעגל ושטחים' }],
    // English keywords
    ['Geometry basics', { chapter: 'Introduction to Geometry' }],
    ['Triangle properties', { chapter: 'Chapter about triangles' }],
    ['Circle area', { chapter: 'Circle and sectors' }],
    ['Polygon angles', { chapter: 'Polygons and angles' }],
  ]

  geometryCases.forEach(([desc, input]) => {
    it(`detects geometry for: ${desc}`, async () => {
      const detectLessonSubject = await getDetectLessonSubject()
      expect(detectLessonSubject).not.toBeNull()
      const result = detectLessonSubject!(
        input.lesson ? { title: input.lesson } : { title: 'Lesson' },
        input.chapter ? { title: input.chapter } : { title: 'Chapter' },
        input.course ? { title: input.course } : { title: 'Course' },
      )
      expect(result).toBe('geometry')
    })
  })
})

// ---------------------------------------------------------------------------
// Calculus detection — Hebrew + English keywords
// ---------------------------------------------------------------------------

describe('detectLessonSubject — calculus detection', () => {
  const calculusCases: Array<[string, { lesson?: string; chapter?: string; course?: string }]> = [
    // Hebrew keywords
    ['חשבון דיפרנציאלי', { chapter: 'פרק חשבון דיפרנציאלי' }],
    ['נגזרות ואינטגרלים', { chapter: 'נגזרות' }],
    ['אינטגרלים מסוימים', { chapter: 'אינטגרל' }],
    // English keywords
    ['Limits and derivatives', { chapter: 'Introduction to Calculus' }],
    ['Derivative rules', { chapter: 'Chapter on Derivatives' }],
    ['Integral calculus', { chapter: 'Integrals and Applications' }],
    ['Limit of a function', { chapter: 'Limits' }],
  ]

  calculusCases.forEach(([desc, input]) => {
    it(`detects calculus for: ${desc}`, async () => {
      const detectLessonSubject = await getDetectLessonSubject()
      expect(detectLessonSubject).not.toBeNull()
      const result = detectLessonSubject!(
        input.lesson ? { title: input.lesson } : { title: 'Lesson' },
        input.chapter ? { title: input.chapter } : { title: 'Chapter' },
        input.course ? { title: input.course } : { title: 'Course' },
      )
      expect(result).toBe('calculus')
    })
  })
})

// ---------------------------------------------------------------------------
// Algebra detection — Hebrew + English keywords
// ---------------------------------------------------------------------------

describe('detectLessonSubject — algebra detection', () => {
  const algebraCases: Array<[string, { lesson?: string; chapter?: string; course?: string }]> = [
    // Hebrew keywords
    ['אלגברה ליניארית', { chapter: 'פרק אלגברה' }],
    ['משוואות ממעלה שנייה', { chapter: 'משוואות' }],
    ['פולינומים ושורשים', { chapter: 'פולינום' }],
    // English keywords
    ['Algebra fundamentals', { chapter: 'Introduction to Algebra' }],
    ['Solving equations', { chapter: 'Linear Equations' }],
    ['Polynomial division', { chapter: 'Polynomials' }],
  ]

  algebraCases.forEach(([desc, input]) => {
    it(`detects algebra for: ${desc}`, async () => {
      const detectLessonSubject = await getDetectLessonSubject()
      expect(detectLessonSubject).not.toBeNull()
      const result = detectLessonSubject!(
        input.lesson ? { title: input.lesson } : { title: 'Lesson' },
        input.chapter ? { title: input.chapter } : { title: 'Chapter' },
        input.course ? { title: input.course } : { title: 'Course' },
      )
      expect(result).toBe('algebra')
    })
  })
})

// ---------------------------------------------------------------------------
// Mixed detection — multiple subjects
// ---------------------------------------------------------------------------

describe('detectLessonSubject — mixed detection', () => {
  it('detects mixed when chapter has both geometry and algebra keywords', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Lesson' },
      { title: 'Geometry and Algebra' },
      { title: 'Course' },
    )
    expect(result).toBe('mixed')
  })

  it('detects mixed when course has both calculus and geometry keywords', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Lesson' },
      { title: 'Chapter' },
      { title: 'Calculus and Geometry Course' },
    )
    expect(result).toBe('mixed')
  })

  it('detects mixed when multiple subjects across lesson/chapter/course', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Algebra basics' },
      { title: 'Triangle chapter' },
      { title: 'Course' },
    )
    expect(result).toBe('mixed')
  })
})

// ---------------------------------------------------------------------------
// No match — returns null
// ---------------------------------------------------------------------------

describe('detectLessonSubject — no match', () => {
  it('returns null when no subject keywords are found', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Introduction to Math' },
      { title: 'General Chapter' },
      { title: 'Basic Course' },
    )
    expect(result).toBeNull()
  })

  it('returns null for empty titles', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!({ title: '' }, { title: '' }, { title: '' })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Case insensitivity
// ---------------------------------------------------------------------------

describe('detectLessonSubject — case insensitivity', () => {
  it('detects geometry regardless of case (uppercase)', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Lesson' },
      { title: 'GEOMETRY BASICS' },
      { title: 'Course' },
    )
    expect(result).toBe('geometry')
  })

  it('detects algebra regardless of case (mixed case)', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Lesson' },
      { title: 'AlGeBrA' },
      { title: 'Course' },
    )
    expect(result).toBe('algebra')
  })

  it('detects calculus regardless of case (mixed case)', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'Lesson' },
      { title: 'CALCULUS' },
      { title: 'Course' },
    )
    expect(result).toBe('calculus')
  })
})

// ---------------------------------------------------------------------------
// Other detection — non-math subjects
// ---------------------------------------------------------------------------

describe('detectLessonSubject — other', () => {
  it('returns "other" for non-math titles that do not match known subjects', async () => {
    const detectLessonSubject = await getDetectLessonSubject()
    expect(detectLessonSubject).not.toBeNull()
    const result = detectLessonSubject!(
      { title: 'History Lesson' },
      { title: 'History Chapter' },
      { title: 'History Course' },
    )
    expect(result).toBe('other')
  })
})
