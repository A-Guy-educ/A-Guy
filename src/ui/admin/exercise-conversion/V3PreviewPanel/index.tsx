'use client'

import { useState } from 'react'

interface PreviewDraft {
  title: string
  question: string
  options: string[]
  correctAnswer: number | null
  explanation?: string
  questionType: 'free_response' | 'true_false' | 'mcq'
  diagramDescription?: string
  diagramPosition?: string
}

interface PreviewData {
  title: string
  draft: PreviewDraft
  content: {
    blocks: unknown[]
  }
  metadata: {
    model: string
    processingTimeMs: number
    promptId?: string
    promptVersion?: string
  }
  extractionLogId: string
}

interface V3PreviewPanelProps {
  preview: PreviewData
  lessonId: string
  mediaId: string
  onClose: () => void
  onCreated: (exerciseId: string) => void
}

/**
 * V3 Preview Panel Component
 *
 * Displays extracted exercise preview with editable fields.
 * Allows admin to edit and create the exercise.
 */
export function V3PreviewPanel({
  preview,
  lessonId,
  mediaId,
  onClose,
  onCreated,
}: V3PreviewPanelProps) {
  const [title, setTitle] = useState(preview.draft.title)
  const [question, setQuestion] = useState(preview.draft.question)
  const [options, setOptions] = useState<string[]>(preview.draft.options)
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(preview.draft.correctAnswer)
  const [explanation, setExplanation] = useState<string>(preview.draft.explanation || '')
  const [acceptedAnswer, setAcceptedAnswer] = useState<string>('')
  const [diagramDescription, setDiagramDescription] = useState<string>(
    preview.draft.diagramDescription || '',
  )
  const [diagramPosition] = useState<string>(preview.draft.diagramPosition || 'before_question')
  const [showJson, setShowJson] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const questionType = preview.draft.questionType

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/exercises/convert/single/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId,
          mediaId,
          title,
          question,
          options,
          correctAnswer,
          explanation,
          acceptedAnswer: acceptedAnswer || undefined,
          extractionLogId: preview.extractionLogId,
          diagramDescription: diagramDescription || undefined,
          diagramPosition: diagramPosition || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create exercise')
      }

      setSuccess(true)
      onCreated(data.data.exerciseId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-0)',
      }}
    >
      <h4
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
          color: 'var(--theme-elevation-1000)',
        }}
      >
        V3 Extraction Preview
      </h4>

      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 4,
            color: 'var(--theme-elevation-600)',
          }}
        >
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-1000)',
          }}
        />
      </div>

      {/* Question */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 4,
            color: 'var(--theme-elevation-600)',
          }}
        >
          Question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-1000)',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Diagram Description */}
      {(diagramDescription || preview.draft.diagramDescription) && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              marginBottom: 4,
              color: 'var(--theme-elevation-600)',
            }}
          >
            Diagram Description
          </label>
          <textarea
            value={diagramDescription}
            onChange={(e) => setDiagramDescription(e.target.value)}
            rows={4}
            placeholder="Markdown+LaTeX description of the diagram..."
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 3,
              backgroundColor: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-1000)',
              resize: 'vertical',
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: 'var(--theme-elevation-500)',
              marginTop: 4,
              display: 'block',
            }}
          >
            This will be inserted as a separate rich text block in the exercise.
          </span>
        </div>
      )}

      {/* Options (for MCQ and True/False) */}
      {questionType !== 'free_response' && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              marginBottom: 4,
              color: 'var(--theme-elevation-600)',
            }}
          >
            Options
          </label>
          {options.map((opt, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
            >
              <input
                type="radio"
                name="correctAnswer"
                checked={correctAnswer === idx}
                onChange={() => setCorrectAnswer(idx)}
                disabled={questionType === 'true_false'}
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const newOptions = [...options]
                  newOptions[idx] = e.target.value
                  setOptions(newOptions)
                }}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 12,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 3,
                  backgroundColor: 'var(--theme-elevation-0)',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Correct Answer (for free response) */}
      {questionType === 'free_response' && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              marginBottom: 4,
              color: 'var(--theme-elevation-600)',
            }}
          >
            Accepted Answer (for grading)
          </label>
          <input
            type="text"
            value={acceptedAnswer}
            onChange={(e) => setAcceptedAnswer(e.target.value)}
            placeholder="Enter accepted answer(s)"
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 3,
              backgroundColor: 'var(--theme-elevation-0)',
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: 'var(--theme-elevation-500)',
              marginTop: 4,
              display: 'block',
            }}
          >
            Note: Correct answer was not detected. Please enter manually.
          </span>
        </div>
      )}

      {/* Explanation */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 4,
            color: 'var(--theme-elevation-600)',
          }}
        >
          Explanation (optional)
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          placeholder="Add explanation..."
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-1000)',
            resize: 'vertical',
          }}
        />
      </div>

      {/* JSON Preview Toggle */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowJson(!showJson)}
          style={{
            fontSize: 10,
            color: 'var(--theme-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showJson ? 'Hide' : 'Show'} Raw JSON
        </button>
        {showJson && (
          <pre
            style={{
              marginTop: 8,
              padding: 8,
              fontSize: 10,
              backgroundColor: 'var(--theme-elevation-100)',
              borderRadius: 3,
              overflow: 'auto',
              maxHeight: 150,
            }}
          >
            {JSON.stringify(preview, null, 2)}
          </pre>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            fontSize: 11,
            color: 'var(--theme-error)',
            backgroundColor: 'var(--theme-error-bg)',
            borderRadius: 3,
          }}
        >
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            fontSize: 11,
            color: 'var(--theme-success)',
            backgroundColor: 'var(--theme-success-bg)',
            borderRadius: 3,
          }}
        >
          Exercise created successfully!
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleCreate}
          disabled={isCreating || success}
          style={{
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 500,
            border: 'none',
            borderRadius: 3,
            backgroundColor: 'var(--theme-success)',
            color: 'var(--theme-success-foreground)',
            cursor: isCreating || success ? 'not-allowed' : 'pointer',
            opacity: isCreating || success ? 0.6 : 1,
          }}
        >
          {isCreating ? 'Creating...' : 'Create Exercise'}
        </button>
        <button
          onClick={onClose}
          disabled={isCreating}
          style={{
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 500,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-600)',
            cursor: isCreating ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default V3PreviewPanel
