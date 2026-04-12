'use client'

import { useField } from '@payloadcms/ui'
import { useCallback, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * @fileType component
 * @domain admin|exercises
 * @pattern context-exercise-viewer
 * @ai-summary Displays and allows editing of parsed exercises from lessonContextText LaTeX content
 */

interface ParsedExercise {
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

interface ParsedSegment {
  exercises: ParsedExercise[]
  extractionIndex: number
  /** Original text of this extraction run */
  originalText: string
}

/** Check if text contains TikZ or minipage diagram markers */
function hasDiagramCheck(text: string): boolean {
  return /\\(begin|end)\{(?:tikzpicture|minipage)\}/.test(text)
}

/**
 * Parse LaTeX text into structured exercise segments.
 * Handles multiple extraction runs separated by \n\n---\n\n
 * Tracks character positions for write-back support.
 */
function parseContextText(contextText: string): ParsedSegment[] {
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

    // Also detect \setcounter{enumi}{N} + \item style exercises
    if (exerciseMatches.length === 0) {
      while ((match = setCounterPattern.exec(runText)) !== null) {
        // Skip matches past the exercise section (answer summaries, solutions)
        if (match.index >= exerciseEndIndex) continue

        const enumi = parseInt(match[1], 10)
        const number = enumi + 1 // \setcounter{enumi}{0} means exercise 1

        // Deduplicate — keep LAST occurrence (later blocks may have continuations)
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

      // Find continuation exercises: plain \item at the same enumerate level
      // Only scan from exercises whose NEXT sequential number is NOT already detected.
      // This avoids mistaking sub-items (\item \textbf{\alph*. }) for exercises.
      const foundNumbers = new Set(exerciseMatches.map((e) => e.number))
      const continuations: typeof exerciseMatches = []
      for (const ex of exerciseMatches) {
        // Only scan if the next number is missing from detected exercises
        if (foundNumbers.has(ex.number + 1)) continue

        const searchStart = ex.index + ex.fullMatch.length
        const region = runText.slice(searchStart, exerciseEndIndex)

        let level = 0
        let exerciseNum = ex.number
        const tokenPattern = /\\begin\{enumerate\}|\\end\{enumerate\}|\\item\b/g
        let tokenMatch
        while ((tokenMatch = tokenPattern.exec(region)) !== null) {
          if (tokenMatch[0] === '\\begin{enumerate}') {
            level++
          } else if (tokenMatch[0] === '\\end{enumerate}') {
            level--
            if (level < 0) break // Exited the containing enumerate block
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
            // Stop after finding one continuation — don't assume more
            break
          }
        }
      }
      exerciseMatches.push(...continuations)

      // Third pass: fill remaining gaps by finding orphan \begin{enumerate} blocks
      // (no \setcounter, no [label=]) between known exercises
      const allFound = new Set(exerciseMatches.map((e) => e.number))
      const maxNum = Math.max(...exerciseMatches.map((e) => e.number))
      const byPos = [...exerciseMatches].sort((a, b) => a.index - b.index)

      for (let gapStart = 1; gapStart <= maxNum; gapStart++) {
        if (allFound.has(gapStart)) continue
        // Find consecutive gap: gapStart..gapEnd
        let gapEnd = gapStart
        while (gapEnd + 1 <= maxNum && !allFound.has(gapEnd + 1)) gapEnd++
        const gapCount = gapEnd - gapStart + 1

        // Find text region: between last exercise before gap and first after
        const prevEx = byPos.filter((e) => e.number < gapStart).pop()
        const nextEx = byPos.find((e) => e.number > gapEnd)
        const regionStart = prevEx ? prevEx.index + prevEx.fullMatch.length : 0
        const regionEnd = nextEx ? nextEx.index : exerciseEndIndex
        const region = runText.slice(regionStart, regionEnd)

        // Find top-level \item entries in \begin{enumerate} blocks without \setcounter
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
              // Orphan if no [label=...] option (those are sub-item blocks)
              inOrphan = !tok[1]
            }
          } else if (tok[0] === '\\end{enumerate}') {
            if (level === 1) inOrphan = false
            level--
            if (level < 0) level = 0 // Reset: exited a block, back to ground
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

        // Skip past this gap group
        gapStart = gapEnd
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

        // Find matching solution
        const solMatch = solutionMatches.find((s) => s.number === current.number)
        let solution: string | null = null
        let solutionHeader: string | null = null
        if (solMatch) {
          solutionHeader = solMatch.fullMatch
          const solContentStart = solMatch.index + solMatch.fullMatch.length
          // Solution ends at next solution or end of text
          const nextSol = solutionMatches.find((s) => s.index > solMatch.index)
          const solContentEnd = nextSol ? nextSol.index : runText.length
          solution = runText.slice(solContentStart, solContentEnd).trim()
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

    segments.push({
      exercises,
      extractionIndex: runIndex + 1,
      originalText: runText,
    })
  }

  return segments
}

/**
 * Reconstruct the full lessonContextText from edited segments.
 * Rebuilds each run by replacing exercise/solution content while preserving
 * the document preamble, headers, and delimiters.
 */
function reconstructContextText(segments: ParsedSegment[]): string {
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

/** Editable LaTeX textarea component */
function EditableLatex({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (newValue: string) => void
  label: string
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--theme-elevation-500)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: 120,
          fontFamily: 'monospace',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--theme-elevation-700)',
          backgroundColor: 'var(--theme-elevation-50)',
          padding: 12,
          borderRadius: 4,
          lineHeight: 1.6,
          border: '1px solid var(--theme-elevation-150)',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

/** Single exercise card component */
function ExerciseCard({
  exercise,
  onContentChange,
  onSolutionChange,
}: {
  exercise: ParsedExercise
  onContentChange: (newContent: string) => void
  onSolutionChange: (newSolution: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        marginBottom: 8,
        overflow: 'hidden',
        backgroundColor: 'var(--theme-elevation-0)',
      }}
    >
      {/* Exercise header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          backgroundColor: isExpanded ? 'var(--theme-elevation-50)' : 'var(--theme-elevation-0)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ color: 'var(--theme-elevation-400)', flexShrink: 0 }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: 'var(--theme-success-100, #dcfce7)',
            color: 'var(--theme-success-600, #16a34a)',
            flexShrink: 0,
          }}
        >
          <BookOpen size={12} />
          {exercise.title}
        </span>
        {exercise.hasDiagram && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--theme-elevation-400)',
              fontStyle: 'italic',
            }}
          >
            (includes diagram)
          </span>
        )}
        {exercise.solution !== null && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--theme-elevation-400)',
              fontStyle: 'italic',
            }}
          >
            (has solution)
          </span>
        )}
      </button>

      {/* Exercise content - editable */}
      {isExpanded && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          <EditableLatex label="Content" value={exercise.latexContent} onChange={onContentChange} />
          {exercise.solution !== null && (
            <EditableLatex label="Solution" value={exercise.solution} onChange={onSolutionChange} />
          )}
        </div>
      )}
    </div>
  )
}

export const ContextExerciseViewer: React.FC = () => {
  const { value: contextText, setValue } = useField<string>({ path: 'lessonContextText' })

  const segments = useMemo(() => parseContextText(contextText || ''), [contextText])

  // Local editable state — initialized from parsed segments
  const [editedSegments, setEditedSegments] = useState<ParsedSegment[]>([])
  const [initialized, setInitialized] = useState(false)

  // Sync parsed segments to editable state when contextText changes externally
  useMemo(() => {
    if (segments.length > 0 || initialized) {
      setEditedSegments(segments)
      setInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextText])

  const totalExercises = editedSegments.reduce((sum, seg) => sum + seg.exercises.length, 0)

  /** Update a specific exercise's content and write back to lessonContextText */
  const updateExercise = useCallback(
    (
      segmentIndex: number,
      exerciseIndex: number,
      field: 'latexContent' | 'solution',
      newValue: string,
    ) => {
      setEditedSegments((prev) => {
        const updated = prev.map((seg, si) => {
          if (si !== segmentIndex) return seg
          return {
            ...seg,
            exercises: seg.exercises.map((ex, ei) => {
              if (ei !== exerciseIndex) return ex
              return { ...ex, [field]: newValue }
            }),
          }
        })

        // Reconstruct and write back to the Payload field
        const newContextText = reconstructContextText(updated)
        setValue(newContextText)

        return updated
      })
    },
    [setValue],
  )

  // Show nothing when lessonContextText is empty
  if (!contextText || !contextText.trim()) {
    return null
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 8,
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--theme-text)',
        }}
      >
        Context Exercises
      </label>
      <p
        style={{
          fontSize: 12,
          color: 'var(--theme-elevation-500)',
          marginBottom: 12,
          marginTop: -4,
        }}
      >
        Extracted exercises from PDF context. {totalExercises} exercise
        {totalExercises !== 1 ? 's' : ''} found. Edit individual exercises below.
      </p>

      {editedSegments.length > 1 && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--theme-elevation-400)',
            marginBottom: 12,
            fontStyle: 'italic',
          }}
        >
          {editedSegments.length} extraction runs detected (separated by --- delimiter)
        </p>
      )}

      {editedSegments.map((segment, segIdx) => (
        <div key={segment.extractionIndex}>
          {editedSegments.length > 1 && (
            <span
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--theme-elevation-400)',
                marginBottom: 8,
                marginTop: segment.extractionIndex > 1 ? 16 : 0,
              }}
            >
              Extraction Run {segment.extractionIndex}
            </span>
          )}
          {segment.exercises.map((exercise, exIdx) => (
            <ExerciseCard
              key={`${segment.extractionIndex}-${exercise.number}`}
              exercise={exercise}
              onContentChange={(val) => updateExercise(segIdx, exIdx, 'latexContent', val)}
              onSolutionChange={(val) => updateExercise(segIdx, exIdx, 'solution', val)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default ContextExerciseViewer
