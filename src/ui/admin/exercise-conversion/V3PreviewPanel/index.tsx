'use client'

import { useState } from 'react'

// Hebrew letters for sub-question numbering
const HEBREW_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י']

interface SubQuestionDraft {
  prompt: string
  type: 'free_response' | 'mcq' | 'true_false'
  options: string[]
  correctAnswer: number | null
  acceptedAnswer?: string
  diagramDescription?: string // NEW: diagram specific to this sub-question
}

interface MultiPartPreviewDraft {
  title: string
  stem?: string
  subQuestions: SubQuestionDraft[]
  diagramDescription?: string
  diagramPosition?: string
}

interface PreviewData {
  title: string
  draft: MultiPartPreviewDraft
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
 * V3 Preview Panel Component (Multi-Part)
 *
 * Displays extracted exercise preview with editable fields.
 * Supports stem + multiple sub-questions with Hebrew letter labels.
 */
export function V3PreviewPanel({
  preview,
  lessonId,
  mediaId,
  onClose,
  onCreated,
}: V3PreviewPanelProps) {
  const [title, setTitle] = useState(preview.draft.title)
  const [stem, setStem] = useState(preview.draft.stem || '')
  const [subQuestions, setSubQuestions] = useState<SubQuestionDraft[]>(
    preview.draft.subQuestions || [],
  )
  const [diagramDescription, setDiagramDescription] = useState<string>(
    preview.draft.diagramDescription || '',
  )
  const [diagramPosition] = useState<string>(preview.draft.diagramPosition || 'before_question')
  const [showJson, setShowJson] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const updateSubQuestion = (index: number, updates: Partial<SubQuestionDraft>) => {
    setSubQuestions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], ...updates }
      return updated
    })
  }

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
          stem: stem || undefined,
          subQuestions,
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
        V3 Extraction Preview (Multi-Part)
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

      {/* Stem - Shared Context */}
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
          Stem (Shared Context / Given Information)
        </label>
        <textarea
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          placeholder="Enter shared context (given information, setup) that applies to all sub-questions..."
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-1000)',
            resize: 'vertical',
            fontStyle: stem ? 'normal' : 'italic',
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
          Optional. Leave empty if there is no shared context between sub-questions.
        </span>
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

      {/* Sub-Questions */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 8,
            color: 'var(--theme-elevation-600)',
          }}
        >
          Sub-Questions ({subQuestions.length})
        </label>

        {subQuestions.map((sq, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 12,
              padding: 10,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 4,
              backgroundColor: 'var(--theme-elevation-50)',
            }}
          >
            {/* Sub-question header with Hebrew letter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-primary-foreground)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {HEBREW_LETTERS[idx] || idx + 1}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--theme-elevation-600)',
                }}
              >
                Sub-question {idx + 1}
              </span>
              <select
                value={sq.type}
                onChange={(e) =>
                  updateSubQuestion(idx, {
                    type: e.target.value as 'free_response' | 'mcq' | 'true_false',
                  })
                }
                style={{
                  marginLeft: 'auto',
                  padding: '2px 6px',
                  fontSize: 11,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 3,
                  backgroundColor: 'var(--theme-elevation-0)',
                }}
              >
                <option value="free_response">Free Response</option>
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True/False</option>
              </select>
            </div>

            {/* Prompt textarea */}
            <textarea
              value={sq.prompt}
              onChange={(e) => updateSubQuestion(idx, { prompt: e.target.value })}
              rows={2}
              placeholder="Enter sub-question text..."
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: 3,
                backgroundColor: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-1000)',
                resize: 'vertical',
                marginBottom: 8,
              }}
            />

            {/* Per-sub-question diagram (if present) */}
            {(sq.diagramDescription || '') && (
              <div style={{ marginBottom: 8 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 500,
                    marginBottom: 4,
                    color: 'var(--theme-elevation-600)',
                  }}
                >
                  Diagram for this sub-question
                </label>
                <textarea
                  value={sq.diagramDescription || ''}
                  onChange={(e) => updateSubQuestion(idx, { diagramDescription: e.target.value })}
                  rows={2}
                  placeholder="Diagram description (optional)..."
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: 11,
                    border: '1px solid var(--theme-elevation-200)',
                    borderRadius: 3,
                    backgroundColor: 'var(--theme-elevation-0)',
                    color: 'var(--theme-elevation-1000)',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}

            {/* Options for MCQ */}
            {sq.type === 'mcq' && (
              <div style={{ marginBottom: 8, paddingLeft: 8 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 500,
                    marginBottom: 4,
                    color: 'var(--theme-elevation-600)',
                  }}
                >
                  Options (select correct answer)
                </span>
                {sq.options.map((opt, optIdx) => (
                  <div
                    key={optIdx}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                  >
                    <input
                      type="radio"
                      name={`correct-${idx}`}
                      checked={sq.correctAnswer === optIdx}
                      onChange={() => updateSubQuestion(idx, { correctAnswer: optIdx })}
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...sq.options]
                        newOptions[optIdx] = e.target.value
                        updateSubQuestion(idx, { options: newOptions })
                      }}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: 12,
                        border: '1px solid var(--theme-elevation-200)',
                        borderRadius: 3,
                        backgroundColor: 'var(--theme-elevation-0)',
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* True/False */}
            {sq.type === 'true_false' && (
              <div style={{ marginBottom: 8, paddingLeft: 8 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 500,
                    marginBottom: 4,
                    color: 'var(--theme-elevation-600)',
                  }}
                >
                  Correct Answer
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input
                    type="radio"
                    name={`tf-${idx}`}
                    checked={sq.correctAnswer === 0}
                    onChange={() => updateSubQuestion(idx, { correctAnswer: 0 })}
                  />
                  True
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input
                    type="radio"
                    name={`tf-${idx}`}
                    checked={sq.correctAnswer === 1}
                    onChange={() => updateSubQuestion(idx, { correctAnswer: 1 })}
                  />
                  False
                </label>
              </div>
            )}

            {/* Accepted Answer for free response */}
            {sq.type === 'free_response' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 500,
                    marginBottom: 4,
                    color: 'var(--theme-elevation-600)',
                  }}
                >
                  Accepted Answer (for grading)
                </label>
                <input
                  type="text"
                  value={sq.acceptedAnswer || ''}
                  onChange={(e) => updateSubQuestion(idx, { acceptedAnswer: e.target.value })}
                  placeholder="Enter accepted answer(s)..."
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: 12,
                    border: '1px solid var(--theme-elevation-200)',
                    borderRadius: 3,
                    backgroundColor: 'var(--theme-elevation-0)',
                  }}
                />
              </div>
            )}
          </div>
        ))}
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
