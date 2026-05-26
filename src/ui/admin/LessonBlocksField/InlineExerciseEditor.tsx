'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'
import { InlineRichTextEditor } from '../ExerciseContentEditor/editors/InlineRichTextEditor'
import { TrueFalseEditor } from '../ExerciseContentEditor/editors/TrueFalseEditor'
import { McqEditor } from '../ExerciseContentEditor/editors/McqEditor'
import { FreeResponseEditor } from '../ExerciseContentEditor/editors/FreeResponseEditor'
import { TableEditor } from '../ExerciseContentEditor/editors/TableEditor'
import { MatchingEditor } from '../ExerciseContentEditor/editors/MatchingEditor'
import { SvgEditor } from '../ExerciseContentEditor/editors/SvgEditor'
import { HtmlBlockEditor } from '../ExerciseContentEditor/editors/HtmlBlockEditor'
import { MediaBlockEditor } from '../ExerciseContentEditor/editors/MediaBlockEditor'
import '../ExerciseContentEditor/index.css'

interface InlineExerciseEditorProps {
  exerciseId: string
  exerciseTitle?: string
  /** Called when the user saves changes to this exercise */
  onSave?: () => void
}

/** Deep-clone a ContentBlock for immutability */
function cloneBlock(block: ContentBlock): ContentBlock {
  return JSON.parse(JSON.stringify(block))
}

function getBlockTypeLabel(block: ContentBlock): string {
  if (block.type === 'question_select' && (block as any).variant === 'true_false')
    return 'True / False'
  if (block.type === 'question_select' && (block as any).variant === 'mcq') return 'Multiple Choice'
  if (block.type === 'question_free_response') return 'Free Response'
  if (block.type === 'question_table') return 'Table Question'
  if (block.type === 'html') return 'HTML Block'
  if (block.type === 'question_matching') return 'Matching'
  if (block.type === 'svg') return 'SVG Image'
  if (block.type === 'media') return 'Media'
  if (block.type === 'latex') return 'LaTeX'
  if (block.type === 'question_geometry') return 'Geometry'
  if (block.type === 'question_axis') return 'Axis Graph'
  if (block.type === 'question_multi_axis') return 'Multi Axis Graph'
  return block.type
}

function InlineBlockRenderer({
  block,
  onChange,
}: {
  block: ContentBlock
  onChange: (updated: ContentBlock) => void
}) {
  const b = block as any

  if (block.type === 'rich_text') {
    return (
      <div className="block-card">
        <div className="block-card-header">
          <div className="block-card-title">Rich Text</div>
        </div>
        <div className="block-card-content">
          <InlineRichTextEditor value={b} onChange={(val) => onChange({ ...b, ...val })} />
        </div>
      </div>
    )
  }

  if (block.type === 'question_select' && b.variant === 'true_false') {
    return (
      <div className="question-block-wrapper">
        <TrueFalseEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'question_select' && b.variant === 'mcq') {
    return (
      <div className="question-block-wrapper">
        <McqEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'question_free_response') {
    return (
      <div className="question-block-wrapper">
        <FreeResponseEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'question_table') {
    return (
      <div className="question-block-wrapper">
        <TableEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'question_matching') {
    return (
      <div className="question-block-wrapper">
        <MatchingEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'svg') {
    return (
      <div className="question-block-wrapper">
        <SvgEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'html') {
    return (
      <div className="question-block-wrapper">
        <HtmlBlockEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  if (block.type === 'media') {
    return (
      <div className="question-block-wrapper">
        <MediaBlockEditor block={b} onChange={(updated) => onChange(updated)} />
      </div>
    )
  }

  // Geometry, Axis, MultiAxis - load dynamically to avoid bundle bloat
  if (
    block.type === 'question_geometry' ||
    block.type === 'question_axis' ||
    block.type === 'question_multi_axis'
  ) {
    return (
      <div className="question-block-wrapper">
        <DynamicGraphBlock block={block} onChange={onChange} />
      </div>
    )
  }

  // Fallback for unknown block types - show JSON
  return (
    <div className="block-card">
      <div className="block-card-header">
        <div className="block-card-title">{getBlockTypeLabel(block)}</div>
      </div>
      <div className="block-card-content">
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(block, null, 2)}</pre>
      </div>
    </div>
  )
}

// Lazy-load geometry/axis editors
const DynamicGraphBlock = React.lazy(() =>
  import('../ExerciseContentEditor/editors/GeometryEditor').then((m) => ({
    default: ({
      block,
      onChange,
    }: {
      block: ContentBlock
      onChange: (b: ContentBlock) => void
    }) => <m.GeometryEditor block={block as any} onChange={(updated: any) => onChange(updated)} />,
  })),
)

/**
 * InlineExerciseEditor — renders an exercise's content blocks inline within
 * the LessonBlocksField, with per-exercise dirty tracking and save.
 *
 * Saves directly to the exercise document via the Payload REST API,
 * independent of the lesson form.
 */
export const InlineExerciseEditor: React.FC<InlineExerciseEditorProps> = ({
  exerciseId,
  exerciseTitle,
  onSave,
}) => {
  const [localBlocks, setLocalBlocks] = useState<ContentBlock[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Fetch exercise content
  useEffect(() => {
    if (!exerciseId) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/exercises/${exerciseId}?depth=0`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch exercise: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const doc = data.doc || data
        const blocks = doc?.content?.blocks || []
        setLocalBlocks(blocks.map(cloneBlock))
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })

    return () => controller.abort()
  }, [exerciseId])

  const handleBlockChange = useCallback((index: number, updated: ContentBlock) => {
    setLocalBlocks((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = updated
      return next
    })
    setHasUnsavedChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!exerciseId || !localBlocks || saving) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/exercises/${exerciseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: { blocks: localBlocks } }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || `Save failed: ${res.status}`)
      }

      setHasUnsavedChanges(false)
      onSave?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [exerciseId, localBlocks, saving, onSave])

  if (loading) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--theme-elevation-500)',
          fontSize: 13,
        }}
      >
        Loading exercise...
      </div>
    )
  }

  if (error && !localBlocks) {
    return (
      <div
        style={{
          padding: '16px',
          color: 'var(--theme-error-500)',
          fontSize: 13,
        }}
      >
        {error}
      </div>
    )
  }

  if (!localBlocks || localBlocks.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--theme-elevation-500)',
          fontSize: 13,
        }}
      >
        No content blocks in this exercise.
      </div>
    )
  }

  return (
    <div className="inline-exercise-editor">
      {/* Exercise header */}
      <div className="inline-exercise-header">
        <div className="inline-exercise-title">{exerciseTitle || 'Untitled Exercise'}</div>
        <div className="inline-exercise-actions">
          {error && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--theme-error-500)',
                marginRight: 8,
              }}
            >
              {error}
            </span>
          )}
          {hasUnsavedChanges && (
            <button
              type="button"
              className="editor-save-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {!hasUnsavedChanges && !error && saving && (
            <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>Saved</span>
          )}
        </div>
      </div>

      {/* Block list */}
      <div className="inline-exercise-blocks">
        {localBlocks.map((block, index) => (
          <div key={block.id || `block-${index}`} className="inline-exercise-block-item">
            <InlineBlockRenderer
              block={block}
              onChange={(updated) => handleBlockChange(index, updated)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
