/**
 * Context Exercise Parser
 *
 * Parses ContextExtractions LaTeX text into structured exercise segments.
 * Shared between the admin ContextExerciseViewer (client) and the
 * server-side exercise creation service.
 */

export interface ParsedExercise {
  number: number
  title: string
  /** The LaTeX header that matched (e.g. "\\textbf{תרגיל 1}") */
  header: string
  latexContent: string
  solution: string | null
  /** The solution header if present (e.g. "\\section*{פתרון תרגיל 1}") */
  solutionHeader: string | null
  hasDiagram: boolean
  /** Character offsets within the extraction run text for reconstruction */
  startIndex: number
  endIndex: number
}

export interface ParsedSegment {
  exercises: ParsedExercise[]
  extractionIndex: number
  /** Original text of this extraction run */
  originalText: string
}

/** Check if text contains TikZ or minipage diagram markers */
export function hasDiagramCheck(text: string): boolean {
  return /\\(begin|end)\{(?:tikzpicture|minipage)\}/.test(text)
}

/**
 * Parse LaTeX text into structured exercise segments.
 * Handles multiple extraction runs separated by \n\n---\n\n
 * Tracks character positions for write-back support.
 */
export function parseContextText(contextText: string): ParsedSegment[] {
  if (!contextText || !contextText.trim()) {
    return []
  }

  // Split by extraction run delimiter
  const runs = contextText.split(/\n\n---\n\n/)
  const segments: ParsedSegment[] = []

  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const runText = runs[runIndex]
    if (!runText.trim()) continue

    const exercises: ParsedExercise[] = []

    // Pattern to match exercise titles:
    //   \textbf{תרגיל N ...} or \section*{תרגיל N ...} or \subsection*{תרגיל N ...}
    const exercisePattern =
      /(?:\\textbf\{(תרגיל\s+(\d+)[^}]*)\}|\\section\*?\{(תרגיל\s+(\d+)[^}]*)\}|\\subsection\*?\{(תרגיל\s+(\d+)[^}]*)\})/g

    // Pattern to match exercises via \setcounter{enumi}{N} followed by \item
    // Does NOT require \begin{enumerate} — handles mid-enumerate setcounter too
    const setCounterPattern = /\\setcounter\{enumi\}\{(\d+)\}\s*\n?\s*\\item\b/g

    // Find all solution boundaries (matches both פתרון תרגיל N and פתרון שאלה N)
    let match
    const solutionPattern =
      /(?:\\section\*?\{(פתרון\s+(?:תרגיל|שאלה)\s+(\d+))\}|\\subsection\*?\{(פתרון\s+(?:תרגיל|שאלה)\s+(\d+))\})/g
    const solutionMatches: Array<{
      index: number
      number: number
      fullMatch: string
    }> = []
    while ((match = solutionPattern.exec(runText)) !== null) {
      const number = parseInt(match[2] || match[4], 10)
      solutionMatches.push({ index: match.index, number, fullMatch: match[0] })
    }

    // Find the start of solutions/post-exercise section
    const solutionsSectionMatch = runText.match(/\\section\*?\{פתרונות\}/)
    const solutionsSectionStart = solutionsSectionMatch?.index ?? runText.length
    const firstSolutionHeader =
      solutionMatches.length > 0 ? solutionMatches[0].index : runText.length
    const firstSolutionIndex = Math.min(solutionsSectionStart, firstSolutionHeader)

    // Find end of exercise section — "בהצלחה!" after questions marks the boundary
    // (answer summaries and דגשים sections come after it but before solutions)
    // Use the LAST "בהצלחה!" before firstSolutionIndex as the exercise boundary
    let exerciseEndIndex = firstSolutionIndex
    const behatzlachaPattern = /בהצלחה!/g
    let behatzlachaMatch
    while ((behatzlachaMatch = behatzlachaPattern.exec(runText)) !== null) {
      if (behatzlachaMatch.index < firstSolutionIndex) {
        exerciseEndIndex = behatzlachaMatch.index
      }
    }

    // Find all exercise boundaries
    const exerciseMatches: Array<{
      index: number
      title: string
      number: number
      fullMatch: string
    }> = []

    while ((match = exercisePattern.exec(runText)) !== null) {
      const title = match[1] || match[3] || match[5]
      const number = parseInt(match[2] || match[4] || match[6], 10)
      exerciseMatches.push({
        index: match.index,
        title,
        number,
        fullMatch: match[0],
      })
    }

    // Track whether matches came from the primary \textbf/\section pattern,
    // so we know to apply phantom-exercise filtering (only safe for that path).
    const usedPrimaryPattern = exerciseMatches.length > 0

    // Also detect \setcounter{enumi}{N} + \item style exercises
    // (runs even if primary pattern found some matches — handles mixed formats)
    if (exerciseMatches.length === 0) {
      // Pass 1: Find all \setcounter{enumi}{N}\item anchors
      while ((match = setCounterPattern.exec(runText)) !== null) {
        if (match.index >= exerciseEndIndex) continue

        const enumi = parseInt(match[1], 10)
        const number = enumi + 1 // \setcounter{enumi}{0} means exercise 1

        const existingIdx = exerciseMatches.findIndex((e) => e.number === number)
        if (existingIdx !== -1) {
          exerciseMatches[existingIdx] = {
            index: match.index,
            title: `תרגיל ${number}`,
            number,
            fullMatch: match[0],
          }
          continue
        }

        exerciseMatches.push({
          index: match.index,
          title: `תרגיל ${number}`,
          number,
          fullMatch: match[0],
        })
      }

      // Pass 1b: Find \item[N.] bracket-numbered exercises
      const itemBracketPattern = /\\item\[(\d+)\.\]/g
      while ((match = itemBracketPattern.exec(runText)) !== null) {
        if (match.index >= exerciseEndIndex) continue
        const number = parseInt(match[1], 10)
        if (exerciseMatches.some((e) => e.number === number)) continue
        exerciseMatches.push({
          index: match.index,
          title: `תרגיל ${number}`,
          number,
          fullMatch: match[0],
        })
      }

      // Pass 1c: Find \item N. inline-numbered exercises (e.g., "\item 42. content")
      const itemInlinePattern = /\\item\s+(\d+)\.\s/g
      while ((match = itemInlinePattern.exec(runText)) !== null) {
        if (match.index >= exerciseEndIndex) continue
        const number = parseInt(match[1], 10)
        if (exerciseMatches.some((e) => e.number === number)) continue
        exerciseMatches.push({
          index: match.index,
          title: `תרגיל ${number}`,
          number,
          fullMatch: match[0].trimEnd(),
        })
      }

      // Pass 2: Find continuation exercises (plain \item after a known exercise)
      // Scan ALL detected exercises, not just those missing the next number
      const foundNumbers = new Set(exerciseMatches.map((e) => e.number))
      const continuations: typeof exerciseMatches = []
      for (const ex of exerciseMatches) {
        if (foundNumbers.has(ex.number + 1)) continue

        const searchStart = ex.index + ex.fullMatch.length
        const region = runText.slice(searchStart, exerciseEndIndex)

        let level = 0
        let exerciseNum = ex.number
        const tokenPattern =
          /\\begin\{enumerate\}(\[[^\]]*\])?|\\end\{enumerate\}|\\setcounter\{enumi\}\{\d+\}|\\item\b/g
        let tokenMatch
        while ((tokenMatch = tokenPattern.exec(region)) !== null) {
          if (tokenMatch[0].startsWith('\\begin{enumerate}')) {
            level++
            // Sub-enumerate blocks with [label=...] are sub-items, not exercises
            if (level === 1 && tokenMatch[1]) {
              // Skip the entire sub-block
              let subLevel = 1
              while (subLevel > 0 && (tokenMatch = tokenPattern.exec(region)) !== null) {
                if (tokenMatch[0].startsWith('\\begin{enumerate}')) subLevel++
                else if (tokenMatch[0] === '\\end{enumerate}') subLevel--
              }
              level--
              continue
            }
          } else if (tokenMatch[0] === '\\end{enumerate}') {
            level--
            if (level < 0) break // Exited the containing enumerate block
          } else if (tokenMatch[0].startsWith('\\setcounter')) {
            // A setcounter means the next item has an explicit number — stop continuation
            break
          } else if (tokenMatch[0] === '\\item' && level === 0) {
            exerciseNum++
            const absIndex = searchStart + tokenMatch.index
            if (
              absIndex >= exerciseEndIndex ||
              foundNumbers.has(exerciseNum) ||
              continuations.some((e) => e.number === exerciseNum)
            ) {
              continue
            }
            continuations.push({
              index: absIndex,
              title: `תרגיל ${exerciseNum}`,
              number: exerciseNum,
              fullMatch: tokenMatch[0],
            })
            foundNumbers.add(exerciseNum)
            // Don't break — continue finding more continuations
          }
        }
      }
      exerciseMatches.push(...continuations)

      // Pass 3: Fill remaining gaps with orphan enumerate blocks
      const allFound = new Set(exerciseMatches.map((e) => e.number))
      if (exerciseMatches.length > 0) {
        const maxNum = Math.max(...exerciseMatches.map((e) => e.number))
        const byPos = [...exerciseMatches].sort((a, b) => a.index - b.index)

        for (let gapStart = 1; gapStart <= maxNum; gapStart++) {
          if (allFound.has(gapStart)) continue
          let gapEnd = gapStart
          while (gapEnd + 1 <= maxNum && !allFound.has(gapEnd + 1)) gapEnd++
          const gapCount = gapEnd - gapStart + 1

          const prevEx = byPos.filter((e) => e.number < gapStart).pop()
          const nextEx = byPos.find((e) => e.number > gapEnd)
          const regionStart = prevEx ? prevEx.index + prevEx.fullMatch.length : 0
          const regionEnd = nextEx ? nextEx.index : exerciseEndIndex
          const region = runText.slice(regionStart, regionEnd)

          const orphanItems: number[] = []
          let level = 0
          let inOrphan = false
          const tokPat =
            /\\begin\{enumerate\}(\[[^\]]*\])?|\\end\{enumerate\}|\\setcounter\{enumi\}|\\item\b/g
          let tok
          while ((tok = tokPat.exec(region)) !== null) {
            if (tok[0].startsWith('\\begin{enumerate}')) {
              level++
              if (level === 1) {
                inOrphan = !tok[1]
              }
            } else if (tok[0] === '\\end{enumerate}') {
              if (level === 1) inOrphan = false
              level--
              if (level < 0) level = 0
            } else if (tok[0].startsWith('\\setcounter')) {
              if (level === 1) inOrphan = false
            } else if (tok[0] === '\\item' && level === 1 && inOrphan) {
              orphanItems.push(regionStart + tok.index)
            }
          }

          const toAssign = Math.min(orphanItems.length, gapCount)
          for (let i = 0; i < toAssign; i++) {
            const num = gapStart + i
            exerciseMatches.push({
              index: orphanItems[i],
              title: `תרגיל ${num}`,
              number: num,
              fullMatch: '\\item',
            })
            allFound.add(num)
          }

          gapStart = gapEnd
        }
      }

      // Sort by exercise number for consistent display order
      exerciseMatches.sort((a, b) => a.number - b.number)
    }

    if (exerciseMatches.length === 0) {
      // No exercises found — treat entire text as one exercise
      exercises.push({
        number: 1,
        title: 'תרגיל 1',
        header: '',
        latexContent: runText,
        solution: null,
        solutionHeader: null,
        hasDiagram: hasDiagramCheck(runText),
        startIndex: 0,
        endIndex: runText.length,
      })
    } else {
      // Sort by text position for correct content boundary slicing
      const byPosition = [...exerciseMatches].sort((a, b) => a.index - b.index)

      // Process each exercise
      for (let i = 0; i < exerciseMatches.length; i++) {
        const current = exerciseMatches[i]
        // Find the next exercise by text position (not by number) for content boundary
        const posIdx = byPosition.indexOf(current)
        const nextByPos = posIdx < byPosition.length - 1 ? byPosition[posIdx + 1] : null

        // Content starts after the exercise header
        const contentStart = current.index + current.fullMatch.length
        // Content ends at the next exercise boundary (by position), solutions section, or end of text
        const contentEnd = nextByPos ? nextByPos.index : firstSolutionIndex

        const latexContent = runText.slice(contentStart, contentEnd).trim()

        // Find matching solution — prefer the longest match when duplicates exist
        const solCandidates = solutionMatches.filter((s) => s.number === current.number)
        let solution: string | null = null
        let solutionHeader: string | null = null
        for (const solMatch of solCandidates) {
          const solContentStart = solMatch.index + solMatch.fullMatch.length
          const nextSol = solutionMatches.find((s) => s.index > solMatch.index)
          const solContentEnd = nextSol ? nextSol.index : runText.length
          const candidate = runText.slice(solContentStart, solContentEnd).trim()
          if (candidate.length > (solution?.length ?? 0)) {
            solutionHeader = solMatch.fullMatch
            solution = candidate
          }
        }

        exercises.push({
          number: current.number,
          title: current.title,
          header: current.fullMatch,
          latexContent,
          solution,
          solutionHeader,
          hasDiagram: hasDiagramCheck(latexContent),
          startIndex: current.index,
          endIndex: contentEnd,
        })
      }
    }

    // For the primary \textbf{תרגיל N} pattern only: dedup by exercise number
    // (keeping the longest content variant), then if any exercise in this run
    // has a matched solution, drop phantom matches that lack one. Why: the
    // page-by-page LLM extraction occasionally emits stray \textbf{תרגיל N}
    // headers over answer-summary fragments or sub-item labels (ה. ו.) that
    // never get a corresponding \section*{פתרון תרגיל N}.
    let finalExercises = exercises
    if (usedPrimaryPattern) {
      const byNumber = new Map<number, ParsedExercise>()
      for (const ex of exercises) {
        const existing = byNumber.get(ex.number)
        if (!existing || ex.latexContent.length > existing.latexContent.length) {
          byNumber.set(ex.number, ex)
        }
      }
      const dedup = Array.from(byNumber.values())
      const anyHasSolution = dedup.some((ex) => ex.solution !== null)
      finalExercises = anyHasSolution ? dedup.filter((ex) => ex.solution !== null) : dedup
    }

    segments.push({
      exercises: finalExercises,
      extractionIndex: runIndex + 1,
      originalText: runText,
    })
  }

  return segments
}

/**
 * Reconstruct the full ContextExtractions text from edited segments.
 * Rebuilds each run by replacing exercise/solution content while preserving
 * the document preamble, headers, and delimiters.
 */
export function reconstructContextText(segments: ParsedSegment[]): string {
  const runs: string[] = []

  for (const segment of segments) {
    const runText = segment.originalText
    const { exercises } = segment

    // If only one exercise with no header, the entire run IS the content
    if (exercises.length === 1 && !exercises[0].header) {
      runs.push(exercises[0].latexContent)
      continue
    }

    // Find preamble (everything before first exercise)
    const firstExercise = exercises[0]
    const preamble = runText.slice(0, firstExercise.startIndex)

    // Rebuild: preamble + exercises + solutions
    const parts: string[] = [preamble]

    for (const ex of exercises) {
      parts.push(ex.header)
      parts.push('\n')
      parts.push(ex.latexContent)
      parts.push('\n\n')
    }

    // Rebuild solutions section
    for (const ex of exercises) {
      if (ex.solution !== null && ex.solutionHeader) {
        parts.push(ex.solutionHeader)
        parts.push('\n')
        parts.push(ex.solution)
        parts.push('\n\n')
      }
    }

    // Check if there's a \end{document} that should be preserved
    if (runText.includes('\\end{document}') && !parts.some((p) => p.includes('\\end{document}'))) {
      parts.push('\\end{document}\n')
    }

    runs.push(parts.join(''))
  }

  return runs.join('\n\n---\n\n')
}
