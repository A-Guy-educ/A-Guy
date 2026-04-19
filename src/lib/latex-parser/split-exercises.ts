/**
 * @fileType utility
 * @domain exercises
 * @pattern latex-parser|solution-routing
 * @ai-summary Split LaTeX documents into individual exercise chunks for AI parsing.
 *
 * @solution-routing-contract
 * Solutions MUST be placed inside question block `solution` fields — never as separate
 * LaTeX blocks. The combined LaTeX block format (Step 4 → Step 5) joins exercise content
 * and solution using \section*{פתרון} so downstream conversion sees them together.
 */

/**
 * Split a full LaTeX document into individual exercise chunks for AI parsing.
 *
 * Algorithm:
 * 1. Strips preamble (everything before \begin{document}).
 * 2. Finds exercise boundaries via \textbf{תרגיל N} pattern.
 * 3. For each exercise chunk: strips everything from the first
 *    \section*{פתרון...} header onward. Solutions stay in the
 *    question block `solution` field after AI conversion, not in
 *    separate LaTeX blocks.
 * 4. Filters out any chunk whose title contains "פתרון".
 *
 * @param latex - Raw LaTeX document string
 * @returns Array of { title, latex } chunks, one per exercise
 */
export function splitLatexIntoExercises(
  latex: string,
): Array<{ title: string; latex: string }> {
  // Strip preamble (everything before \begin{document})
  const docStart = latex.indexOf('\\begin{document}')
  const body = docStart >= 0 ? latex.slice(docStart) : latex

  // Split on exercise titles: \textbf{תרגיל N ...}
  const exercisePattern = /\\textbf\{תרגיל\s+(\d+)[^}]*\}/g
  const matches = [...body.matchAll(exercisePattern)]

  if (matches.length === 0) {
    // No exercise boundaries found — send the whole thing as one chunk
    return [{ title: '', latex: body }]
  }

  const chunks: Array<{ title: string; latex: string }> = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const start = match.index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
    const rawChunk = body.slice(start, end)

    // Skip chunks that are pure solution sections (start with solution header)
    if (/^\\section\*?\{פתרון/.test(rawChunk.trim())) continue

    // Strip everything from the first solution section onward — solutions go
    // into the question block `solution` field, not into exercise LaTeX blocks.
    // Find the first \section*{פתרון...} and truncate the chunk before it.
    const solutionPatterns = [
      '\\section*{פתרון',
      '\\section*{פתרונות',
      '\\subsection*{פתרון',
    ]
    let solutionIdx = -1
    for (const pattern of solutionPatterns) {
      const idx = rawChunk.indexOf(pattern)
      if (idx !== -1 && (solutionIdx === -1 || idx < solutionIdx)) {
        solutionIdx = idx
      }
    }
    const chunkLatex =
      solutionIdx !== -1 ? rawChunk.slice(0, solutionIdx).trim() : rawChunk.trim()

    chunks.push({
      title: match[0].replace(/\\textbf\{|\}/g, '').trim(),
      latex: chunkLatex,
    })
  }

  // Filter out solution exercises (title contains "פתרון")
  return chunks.filter((c) => !c.title.includes('פתרון'))
}
