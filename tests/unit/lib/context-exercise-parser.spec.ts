import { describe, expect, it } from 'vitest'
import { parseContextText } from '@/lib/context-exercise-parser'

describe('parseContextText — secondary detection always runs', () => {
  it('detects setCounter continuations even when primary \\textbf already matched', () => {
    // Page 1 of an LLM extraction emits a labelled header for ex. 1, then
    // continues with \setcounter+\item for ex. 2-3. Before the gate fix the
    // parser saw 1 exercise and merged the rest into its body.
    // Layout note: all exercise bodies precede all solutions — the parser
    // anchors its exerciseEndIndex at the first solution header.
    const text = `\\begin{document}

\\textbf{תרגיל 1}
תוכן ראשון

\\begin{enumerate}
\\setcounter{enumi}{1}
\\item תוכן שני
\\setcounter{enumi}{2}
\\item תוכן שלישי
\\end{enumerate}

\\section*{פתרון תרגיל 1}
פתרון אחד
\\section*{פתרון תרגיל 2}
פתרון שני
\\section*{פתרון תרגיל 3}
פתרון שלישי

\\end{document}`

    const exercises = parseContextText(text).flatMap((s) => s.exercises)
    expect(exercises.map((e) => e.number).sort()).toEqual([1, 2, 3])
  })

  it('preserves the original textbf title and position when setCounter matches the same number', () => {
    // Pass 1 used to overwrite a primary-pattern match with a setCounter
    // token, destroying the descriptive title and shifting the position to
    // the setCounter location. reconstructContextText then wrote back a
    // setCounter token in place of the original \textbf header on save.
    const text = `\\begin{document}

\\textbf{תרגיל 1 שאלה ראשונה}
פסקה ראשונה

\\begin{enumerate}
\\setcounter{enumi}{0}
\\item פסקה שניה
\\end{enumerate}

\\section*{פתרון תרגיל 1}
פתרון
\\end{document}`

    const exercises = parseContextText(text).flatMap((s) => s.exercises)
    const ex1 = exercises.find((e) => e.number === 1)
    expect(ex1).toBeDefined()
    expect(ex1!.title).toBe('תרגיל 1 שאלה ראשונה')
    expect(ex1!.header).toContain('\\textbf{תרגיל 1 שאלה ראשונה}')
    expect(ex1!.header).not.toContain('\\setcounter')
  })

  it('keeps an exercise found via setCounter when its solution is present', () => {
    // Phantom-filter: with usedPrimaryPattern=true and any matched solution,
    // exercises lacking one are dropped. setCounter-found ones must carry a
    // \section*{פתרון תרגיל N} to survive.
    const text = `\\begin{document}

\\textbf{תרגיל 1}
תוכן 1

\\begin{enumerate}
\\setcounter{enumi}{1}
\\item תוכן 2
\\end{enumerate}

\\section*{פתרון תרגיל 1}
פתרון 1
\\section*{פתרון תרגיל 2}
פתרון 2

\\end{document}`

    const exercises = parseContextText(text).flatMap((s) => s.exercises)
    expect(exercises.map((e) => e.number).sort()).toEqual([1, 2])
  })

  it('falls back to single-exercise when no markers match (legacy free-form output)', () => {
    const text = 'just some prose with no \\textbf or \\setcounter markers'
    const exercises = parseContextText(text).flatMap((s) => s.exercises)
    expect(exercises).toHaveLength(1)
    expect(exercises[0].number).toBe(1)
    expect(exercises[0].latexContent).toBe(text)
  })

  it('returns no exercises for empty input', () => {
    expect(parseContextText('')).toEqual([])
    expect(parseContextText('   \n\n  ')).toEqual([])
  })
})
