'use client'

import { useField } from '@payloadcms/ui'
import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * @fileType component
 * @domain admin|exercises
 * @pattern context-exercise-viewer
 * @ai-summary Displays parsed exercises from lessonContextText LaTeX content
 */

interface ParsedExercise {
  number: number
  title: string
  latexContent: string
  solution: string | null
  hasDiagram: boolean
}

interface ParsedSegment {
  exercises: ParsedExercise[]
  extractionIndex: number
}

/** Check if text contains TikZ or minipage diagram markers */
function hasDiagram(text: string): boolean {
  return /\\(begin|end)\{(?:tikzpicture|minipage)\}/.test(text)
}

/**
 * Parse LaTeX text into structured exercise segments.
 * Handles multiple extraction runs separated by \n\n---\n\n
 */
function parseContextText(contextText: string): ParsedSegment[] {
  if (!contextText || !contextText.trim()) {
    return []
  }

  // Split by extraction run delimiter
  const runs = contextText.split(/\n\n---\n\n/)
  const segments: ParsedSegment[] = []

  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const runText = runs[runIndex].trim()
    if (!runText) continue

    const exercises: ParsedExercise[] = []

    // Pattern to match exercise titles: \textbf{תרגיל N ...} or \section*{תרגיל N ...}
    const exercisePattern =
      /(?:\\textbf\{(תרגיל\s+(\d+)[^}]*)\}|\\section\*?\{(תרגיל\s+(\d+)[^}]*)\}|\\subsection\*?\{(תרגיל\s+(\d+)[^}]*)\})/g

    // Pattern to match solution headers: \section*{פתרון תרגיל N} etc.
    const solutionPattern =
      /(?:\\section\*?\{פתרון\s+תרגיל\s+(\d+)\}|\\subsection\*?\{פתרון\s+תרגיל\s+(\d+)\})/g

    let match

    // Find all exercise boundaries
    const exerciseMatches: Array<{
      index: number
      title: string
      number: number
      length: number
    }> = []

    while ((match = exercisePattern.exec(runText)) !== null) {
      const title = match[1] || match[3] || match[5]
      const number = parseInt(match[2] || match[4] || match[6], 10)
      exerciseMatches.push({
        index: match.index,
        title,
        number,
        length: match[0].length,
      })
    }

    // If no exercises found, treat the entire text as one exercise
    if (exerciseMatches.length === 0) {
      exercises.push({
        number: 1,
        title: 'תרגיל 1',
        latexContent: runText,
        solution: null,
        hasDiagram: hasDiagram(runText),
      })
    } else {
      // Process each exercise boundary
      for (let i = 0; i < exerciseMatches.length; i++) {
        const current = exerciseMatches[i]
        const next = exerciseMatches[i + 1]

        // Content starts after the exercise title
        const contentStart = current.index + current.length
        // Content ends at the next exercise boundary or end of text
        const contentEnd = next ? next.index : runText.length
        let latexContent = runText.slice(contentStart, contentEnd).trim()

        // Check for solution within this exercise's content
        let solution: string | null = null
        const solutionMatch = solutionPattern.exec(latexContent)
        if (solutionMatch) {
          const solIndex = solutionMatch.index
          // Solution content starts after the solution header
          const solContentStart = solIndex + solutionMatch[0].length
          solution = latexContent.slice(solContentStart).trim()
          // Remove solution from exercise content
          latexContent = latexContent.slice(0, solIndex).trim()
        }

        exercises.push({
          number: current.number,
          title: current.title,
          latexContent,
          solution,
          hasDiagram: hasDiagram(latexContent),
        })
      }
    }

    segments.push({
      exercises,
      extractionIndex: runIndex + 1,
    })
  }

  return segments
}

/** Simple read-only rich text display component */
function RichTextDisplay({ value }: { value: string }) {
  // For now, render as pre-formatted text since this is read-only display
  // The LaTeX content is shown as-is for admins to verify extraction quality
  return (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'var(--theme-elevation-700)',
        backgroundColor: 'var(--theme-elevation-50)',
        padding: 12,
        borderRadius: 4,
        lineHeight: 1.6,
        maxHeight: 300,
        overflow: 'auto',
      }}
    >
      {value}
    </div>
  )
}

/** Single exercise card component */
function ExerciseCard({ exercise }: { exercise: ParsedExercise }) {
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
      </button>

      {/* Exercise content */}
      {isExpanded && (
        <div style={{ padding: '0 12px 12px 12px' }}>
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
              Content
            </label>
            <RichTextDisplay value={exercise.latexContent} />
          </div>

          {exercise.solution && (
            <div>
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
                Solution
              </label>
              <RichTextDisplay value={exercise.solution} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const ContextExerciseViewer: React.FC = () => {
  const { value: contextText } = useField<string>({ path: 'lessonContextText' })

  const segments = useMemo(() => parseContextText(contextText || ''), [contextText])

  // Calculate total exercise count
  const totalExercises = segments.reduce((sum, seg) => sum + seg.exercises.length, 0)

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
        {totalExercises !== 1 ? 's' : ''} found.
      </p>

      {segments.length > 1 && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--theme-elevation-400)',
            marginBottom: 12,
            fontStyle: 'italic',
          }}
        >
          {segments.length} extraction runs detected (separated by --- delimiter)
        </p>
      )}

      {segments.map((segment) => (
        <div key={segment.extractionIndex}>
          {segments.length > 1 && (
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
          {segment.exercises.map((exercise) => (
            <ExerciseCard
              key={`${segment.extractionIndex}-${exercise.number}`}
              exercise={exercise}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default ContextExerciseViewer
