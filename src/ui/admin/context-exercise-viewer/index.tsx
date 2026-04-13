'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react'
import type { ParsedExercise, ParsedSegment } from '@/lib/context-exercise-parser'
import { parseContextText, reconstructContextText } from '@/lib/context-exercise-parser'

/**
 * @fileType component
 * @domain admin|exercises
 * @pattern context-exercise-viewer
 * @ai-summary Displays and allows editing of parsed exercises from lessonContextText LaTeX content
 */

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
  const { id: lessonId } = useDocumentInfo()

  const segments = useMemo(() => parseContextText(contextText || ''), [contextText])

  // Local editable state — initialized from parsed segments
  const [editedSegments, setEditedSegments] = useState<ParsedSegment[]>([])
  const [initialized, setInitialized] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Sync parsed segments to editable state when contextText changes externally
  useEffect(() => {
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

  const handleCreateExercises = useCallback(async () => {
    if (!lessonId || isCreating) return

    setIsCreating(true)
    setCreateResult(null)

    try {
      const response = await fetch('/api/lessons/create-context-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create exercises')
      }

      setCreateResult({
        type: 'success',
        message: `Created ${data.data?.exerciseCount ?? 0} exercises as LaTeX blocks.`,
      })
    } catch (err) {
      setCreateResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create exercises',
      })
    } finally {
      setIsCreating(false)
    }
  }, [lessonId, isCreating])

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

      <button
        type="button"
        onClick={handleCreateExercises}
        disabled={isCreating || totalExercises === 0}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 500,
          border: '1px solid #000',
          borderRadius: 4,
          backgroundColor: isCreating ? 'var(--theme-elevation-300)' : '#fff',
          color: '#000',
          cursor: isCreating || totalExercises === 0 ? 'not-allowed' : 'pointer',
          opacity: totalExercises === 0 ? 0.5 : 1,
          marginTop: 8,
        }}
      >
        {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        {isCreating ? 'Creating...' : 'Create Exercises'}
      </button>

      {createResult && (
        <div
          style={{
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 4,
            marginTop: 8,
            color: createResult.type === 'success' ? 'var(--theme-success)' : 'var(--theme-error)',
            backgroundColor:
              createResult.type === 'success'
                ? 'var(--theme-success-100)'
                : 'var(--theme-error-100)',
          }}
        >
          {createResult.message}
        </div>
      )}
    </div>
  )
}

export default ContextExerciseViewer
