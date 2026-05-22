'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { ExerciseBlockDefaults, generateId } from '@/server/payload/collections/Exercises/defaults'
import type {
  ContentBlock,
  HtmlBlock,
  LatexBlock,
  MediaBlock,
  QuestionSelectMcqBlock,
  QuestionSelectTrueFalseBlock,
  RichTextBlock,
} from '@/server/payload/collections/Exercises/types'
import { BlockTypeSelector } from '@/ui/admin/ExerciseContentEditor/BlockTypeSelector'
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Save,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react'
import { deepCloneBlock } from '@/ui/admin/ExerciseContentEditor/utils'

// Reuse the rich text inline editor for rich_text block editing
import { InlineRichTextEditor } from '@/ui/admin/ExerciseContentEditor/editors/InlineRichTextEditor'
import type { InlineRichText } from '@/server/payload/collections/Exercises/types'

import './index.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBlock = Record<string, any>

interface ExerciseRef {
  id: string
  title: string
  contentBlocks: ContentBlock[]
  loading: boolean
  error: string | null
  localBlocks: ContentBlock[] // Local state for unsaved changes
  hasUnsavedChanges: boolean
  saving: boolean
}

interface ResolvedBlock {
  index: number
  blockType: string
  refId: string
  loading: boolean
  title: string
}

/** Extract a plain ID string from a value that might be a string ID or a populated object */
function extractId(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 0) return val
  if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
  return null
}

/** Extract title from a potentially populated relationship value */
function extractTitle(val: unknown): string | null {
  if (val && typeof val === 'object' && 'title' in val) {
    return String((val as { title: unknown }).title) || null
  }
  return null
}

/** Parse blocks from the textarea value (string or array) */
function parseBlocks(val: unknown): RawBlock[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore parse errors
    }
  }
  return []
}

/**
 * LessonExerciseEditor
 *
 * Fetches all exercises referenced in the lesson's blocks field and displays them
 * as an editable worksheet. Each exercise shows its content.blocks rendered in a
 * worksheet-style layout with click-to-edit blocks and a per-exercise Save button.
 * Block management (add/reorder/delete) is available for each exercise.
 */
export const LessonExerciseEditor: React.FC<{ path: string }> = ({ path }) => {
  const { value: fieldValue } = useField<string>({ path })

  const blocks: RawBlock[] = useMemo(() => parseBlocks(fieldValue), [fieldValue])

  // Extract exercise IDs from blocks
  const exerciseIds = useMemo(() => {
    const ids: Array<{ id: string; index: number }> = []
    blocks.forEach((block, index) => {
      if (block.blockType === 'exerciseRef') {
        const refId = extractId(block.exercise)
        if (refId) ids.push({ id: refId, index })
      }
    })
    return ids
  }, [blocks])

  // Exercise state: map of exerciseId -> ExerciseRef
  const [exercises, setExercises] = useState<Record<string, ExerciseRef>>({})
  const [loading, setLoading] = useState(true)

  // Fetch exercises
  useEffect(() => {
    if (exerciseIds.length === 0) {
      setExercises({})
      setLoading(false)
      return
    }

    setLoading(true)
    setExercises({})

    let cancelled = false

    Promise.all(
      exerciseIds.map(({ id }) =>
        fetch(`/api/exercises/${id}?depth=0`, { credentials: 'include' })
          .then((res) => {
            if (!res.ok) throw new Error(`Failed to fetch exercise ${id}`)
            return res.json()
          })
          .then((data) => ({
            id,
            title: data.title || `Exercise`,
            contentBlocks: data?.content?.blocks || [],
          }))
          .catch(() => ({
            id,
            title: `Exercise`,
            contentBlocks: [],
          })),
      ),
    )
      .then((fetched) => {
        if (cancelled) return
        const map: Record<string, ExerciseRef> = {}
        fetched.forEach(({ id, title, contentBlocks }) => {
          map[id] = {
            id,
            title,
            contentBlocks,
            localBlocks: contentBlocks,
            loading: false,
            error: null,
            hasUnsavedChanges: false,
            saving: false,
          }
        })
        setExercises(map)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [exerciseIds])

  // Build display rows for the lesson blocks
  const rows: ResolvedBlock[] = useMemo(() => {
    return blocks
      .map((block, index) => {
        if (block.blockType !== 'exerciseRef') return null
        const refId = extractId(block.exercise)
        if (!refId) return null
        const exercise = exercises[refId]
        return {
          index,
          blockType: block.blockType as string,
          refId,
          title: exercise?.title || extractTitle(block.exercise) || '',
          loading: exercise?.loading ?? true,
        }
      })
      .filter(Boolean) as ResolvedBlock[]
  }, [blocks, exercises])

  // Update a single block in an exercise's local state
  const handleUpdateBlock = useCallback(
    (exerciseId: string, blockId: string, updates: Partial<ContentBlock>) => {
      setExercises((prev) => {
        const exercise = prev[exerciseId]
        if (!exercise) return prev
        return {
          ...prev,
          [exerciseId]: {
            ...exercise,
            localBlocks: exercise.localBlocks.map((b) =>
              b.id === blockId ? ({ ...b, ...updates } as ContentBlock) : b,
            ),
            hasUnsavedChanges: true,
          },
        }
      })
    },
    [],
  )

  // Add a new block to an exercise
  const handleAddBlock = useCallback(
    (exerciseId: string, blockType: string, insertAtIndex?: number) => {
      const newBlock = ExerciseBlockDefaults[blockType]() as ContentBlock
      setExercises((prev) => {
        const exercise = prev[exerciseId]
        if (!exercise) return prev
        const newBlocks = [...exercise.localBlocks]
        if (insertAtIndex !== undefined) {
          newBlocks.splice(insertAtIndex + 1, 0, newBlock)
        } else {
          newBlocks.push(newBlock)
        }
        return {
          ...prev,
          [exerciseId]: {
            ...exercise,
            localBlocks: newBlocks,
            hasUnsavedChanges: true,
          },
        }
      })
    },
    [],
  )

  // Delete a block from an exercise
  const handleDeleteBlock = useCallback((exerciseId: string, blockId: string) => {
    setExercises((prev) => {
      const exercise = prev[exerciseId]
      if (!exercise) return prev
      const newBlocks = exercise.localBlocks.filter((b) => b.id !== blockId)
      // Ensure at least one block
      if (newBlocks.length === 0) {
        newBlocks.push({
          id: generateId(),
          type: 'rich_text',
          format: 'md-math-v1',
          value: '',
          mediaIds: [],
        } as ContentBlock)
      }
      return {
        ...prev,
        [exerciseId]: {
          ...exercise,
          localBlocks: newBlocks,
          hasUnsavedChanges: true,
        },
      }
    })
  }, [])

  // Move a block within an exercise
  const handleMoveBlock = useCallback(
    (exerciseId: string, blockId: string, direction: 'up' | 'down') => {
      setExercises((prev) => {
        const exercise = prev[exerciseId]
        if (!exercise) return prev
        const index = exercise.localBlocks.findIndex((b) => b.id === blockId)
        if (index === -1) return prev
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= exercise.localBlocks.length) return prev
        const newBlocks = [...exercise.localBlocks]
        const [moved] = newBlocks.splice(index, 1)
        newBlocks.splice(targetIndex, 0, moved)
        return {
          ...prev,
          [exerciseId]: {
            ...exercise,
            localBlocks: newBlocks,
            hasUnsavedChanges: true,
          },
        }
      })
    },
    [],
  )

  // Duplicate a block
  const handleDuplicateBlock = useCallback((exerciseId: string, blockId: string) => {
    setExercises((prev) => {
      const exercise = prev[exerciseId]
      if (!exercise) return prev
      const index = exercise.localBlocks.findIndex((b) => b.id === blockId)
      if (index === -1) return prev
      const originalBlock = exercise.localBlocks[index]
      const duplicatedBlock = deepCloneBlock(originalBlock)
      const newBlocks = [...exercise.localBlocks]
      newBlocks.splice(index + 1, 0, duplicatedBlock)
      return {
        ...prev,
        [exerciseId]: {
          ...exercise,
          localBlocks: newBlocks,
          hasUnsavedChanges: true,
        },
      }
    })
  }, [])

  // Save an exercise's content.blocks
  const handleSaveExercise = useCallback(
    async (exerciseId: string) => {
      const exercise = exercises[exerciseId]
      if (!exercise) return

      setExercises((prev) => ({
        ...prev,
        [exerciseId]: { ...prev[exerciseId], saving: true },
      }))

      try {
        const res = await fetch(`/api/exercises/${exerciseId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { blocks: exercise.localBlocks } }),
        })

        if (!res.ok) throw new Error('Save failed')

        setExercises((prev) => ({
          ...prev,
          [exerciseId]: {
            ...prev[exerciseId],
            contentBlocks: prev[exerciseId].localBlocks,
            hasUnsavedChanges: false,
            saving: false,
          },
        }))
      } catch {
        setExercises((prev) => ({
          ...prev,
          [exerciseId]: { ...prev[exerciseId], saving: false },
        }))
      }
    },
    [exercises],
  )

  if (loading) {
    return (
      <div className="lesson-exercise-editor lesson-exercise-editor--loading">
        <div className="lesson-exercise-editor__loading">
          <Loader2 size={20} className="spin" />
          <span>Loading exercises...</span>
        </div>
      </div>
    )
  }

  if (exerciseIds.length === 0) {
    return (
      <div className="lesson-exercise-editor">
        <div className="lesson-exercise-editor__empty">
          <p>No exercises in this lesson yet.</p>
          <p className="lesson-exercise-editor__empty-hint">
            Add exercises using the Lesson Blocks field above.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-exercise-editor">
      <div className="lesson-exercise-editor__header">
        <h3>Exercise Worksheet Editor</h3>
        <p className="lesson-exercise-editor__description">
          Click on any block to edit it. Use the per-exercise Save button to persist changes.
        </p>
      </div>

      <div className="lesson-exercise-editor__list">
        {rows.map((row, displayIndex) => {
          const exercise = exercises[row.refId]
          if (!exercise) return null
          return (
            <ExerciseEditorCard
              key={row.refId}
              exercise={exercise}
              displayNumber={displayIndex + 1}
              onUpdateBlock={(blockId, updates) => handleUpdateBlock(row.refId, blockId, updates)}
              onAddBlock={(blockType, insertAtIndex) =>
                handleAddBlock(row.refId, blockType, insertAtIndex)
              }
              onDeleteBlock={(blockId) => handleDeleteBlock(row.refId, blockId)}
              onMoveBlock={(blockId, direction) => handleMoveBlock(row.refId, blockId, direction)}
              onDuplicateBlock={(blockId) => handleDuplicateBlock(row.refId, blockId)}
              onSave={() => handleSaveExercise(row.refId)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Exercise Editor Card
// ------------------------------------------------------------------

interface ExerciseEditorCardProps {
  exercise: ExerciseRef
  displayNumber: number
  onUpdateBlock: (blockId: string, updates: Partial<ContentBlock>) => void
  onAddBlock: (blockType: string, insertAtIndex?: number) => void
  onDeleteBlock: (blockId: string) => void
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void
  onDuplicateBlock: (blockId: string) => void
  onSave: () => void
}

function ExerciseEditorCard({
  exercise,
  displayNumber,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
  onDuplicateBlock,
  onSave,
}: ExerciseEditorCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [blockTypeSelectorOpen, setBlockTypeSelectorOpen] = useState(false)
  const [insertAtIndex, setInsertAtIndex] = useState<number | undefined>(undefined)

  const handleAddBlock = (index?: number) => {
    setInsertAtIndex(index)
    setBlockTypeSelectorOpen(true)
  }

  const handleBlockTypeSelected = (blockType: string) => {
    onAddBlock(blockType, insertAtIndex)
    setBlockTypeSelectorOpen(false)
  }

  return (
    <div className={`exercise-card ${expanded ? 'exercise-card--expanded' : ''}`}>
      <div className="exercise-card__header" onClick={() => setExpanded(!expanded)}>
        <span className="exercise-card__number">{displayNumber}</span>
        <span className="exercise-card__title">{exercise.title}</span>
        <span className="exercise-card__count">
          {exercise.localBlocks.length} block{exercise.localBlocks.length !== 1 ? 's' : ''}
        </span>
        {exercise.hasUnsavedChanges && (
          <span className="exercise-card__unsaved">Unsaved changes</span>
        )}
        <button
          className="exercise-card__save-btn"
          onClick={(e) => {
            e.stopPropagation()
            onSave()
          }}
          disabled={!exercise.hasUnsavedChanges || exercise.saving}
          type="button"
        >
          {exercise.saving ? (
            <>
              <Loader2 size={14} className="spin" /> Saving...
            </>
          ) : (
            <>
              <Save size={14} /> Save
            </>
          )}
        </button>
        <span className="exercise-card__chevron">
          {expanded ? <ChevronDownIcon size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>

      {expanded && (
        <div className="exercise-card__body">
          {exercise.localBlocks.length === 0 && (
            <div className="exercise-card__empty">
              <p>No blocks. Add one below.</p>
            </div>
          )}

          {exercise.localBlocks.map((block, index) => (
            <EditableBlock
              key={block.id}
              block={block}
              blockIndex={index}
              blockCount={exercise.localBlocks.length}
              isSelected={selectedBlockId === block.id}
              onSelect={() => setSelectedBlockId(selectedBlockId === block.id ? null : block.id)}
              onUpdate={(updates) => onUpdateBlock(block.id, updates)}
              onMoveUp={() => onMoveBlock(block.id, 'up')}
              onMoveDown={() => onMoveBlock(block.id, 'down')}
              onDuplicate={() => onDuplicateBlock(block.id)}
              onDelete={() => onDeleteBlock(block.id)}
              onAddBlock={() => handleAddBlock(index)}
            />
          ))}

          <button
            className="exercise-card__add-block-btn"
            onClick={() => handleAddBlock()}
            type="button"
          >
            <Plus size={14} /> Add Block
          </button>
        </div>
      )}

      <BlockTypeSelector
        isOpen={blockTypeSelectorOpen}
        onClose={() => setBlockTypeSelectorOpen(false)}
        onSelect={handleBlockTypeSelected}
      />
    </div>
  )
}

// ------------------------------------------------------------------
// Editable Block
// ------------------------------------------------------------------

interface EditableBlockProps {
  block: ContentBlock
  blockIndex: number
  blockCount: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<ContentBlock>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onDelete: () => void
  onAddBlock: () => void
}

function EditableBlock({
  block,
  blockIndex,
  blockCount,
  isSelected,
  onSelect,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: EditableBlockProps) {
  const isRichText = block.type === 'rich_text'
  const isHtml = block.type === 'html'
  const isMedia = block.type === 'media'

  const getBlockTypeLabel = (b: ContentBlock): string => {
    if (
      b.type === 'question_select' &&
      (b as QuestionSelectTrueFalseBlock).variant === 'true_false'
    )
      return 'True / False'
    if (b.type === 'question_select' && (b as QuestionSelectMcqBlock).variant === 'mcq')
      return 'Multiple Choice'
    if (b.type === 'question_free_response') return 'Free Response'
    if (b.type === 'question_table') return 'Table Question'
    if (b.type === 'html') return 'HTML Block'
    if (b.type === 'question_matching') return 'Matching'
    if (b.type === 'svg') return 'SVG Image'
    if (b.type === 'media') return 'Media'
    if (b.type === 'latex') return 'LaTeX'
    if (b.type === 'question_geometry') return 'Geometry'
    if (b.type === 'question_axis') return 'Axis Graph'
    if (b.type === 'question_multi_axis') return 'Multi Axis Graph'
    return b.type
  }

  return (
    <div
      className={`editable-block ${isSelected ? 'editable-block--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="editable-block__header">
        <div className="editable-block__header-left">
          <GripVertical size={14} className="editable-block__grip" />
          <span className="editable-block__number">Block {blockIndex + 1}</span>
          <span className="editable-block__type-badge">{getBlockTypeLabel(block)}</span>
        </div>
        <div className="editable-block__actions">
          <button
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveUp()
            }}
            disabled={blockIndex === 0}
            title="Move up"
            type="button"
          >
            <ChevronUp size={14} />
          </button>
          <button
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveDown()
            }}
            disabled={blockIndex === blockCount - 1}
            title="Move down"
            type="button"
          >
            <ChevronDown size={14} />
          </button>
          <button
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            title="Duplicate"
            type="button"
          >
            <Plus size={14} />
          </button>
          <button
            className="icon-button icon-button--delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            disabled={blockCount === 1}
            title="Delete"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="editable-block__content" onClick={(e) => e.stopPropagation()}>
        {isRichText ? (
          <InlineRichTextEditor
            value={{
              value: (block as RichTextBlock).value || '',
              mediaIds: (block as RichTextBlock).mediaIds || [],
              type: 'rich_text',
              format: 'md-math-v1',
            }}
            onChange={(newValue: InlineRichText) =>
              onUpdate({ value: newValue.value, mediaIds: newValue.mediaIds })
            }
          />
        ) : isHtml ? (
          <div className="editable-block__html-edit">
            <textarea
              className="editable-block__html-textarea"
              value={(block as HtmlBlock).html || ''}
              onChange={(e) => onUpdate({ html: e.target.value } as Partial<ContentBlock>)}
              placeholder="Enter HTML content..."
              rows={4}
            />
          </div>
        ) : isMedia ? (
          <div className="editable-block__media-edit">
            <input
              type="text"
              className="editable-block__media-input"
              value={(block as MediaBlock).mediaId || ''}
              onChange={(e) => onUpdate({ mediaId: e.target.value } as Partial<ContentBlock>)}
              placeholder="Media ID"
            />
          </div>
        ) : block.type === 'latex' ? (
          <div className="editable-block__latex-edit">
            <textarea
              className="editable-block__latex-textarea"
              value={(block as LatexBlock).latex || ''}
              onChange={(e) => onUpdate({ latex: e.target.value } as Partial<ContentBlock>)}
              placeholder="Enter LaTeX code..."
              rows={3}
            />
            {(block as LatexBlock).latex && (
              <div className="editable-block__latex-preview">
                <code>{(block as LatexBlock).latex}</code>
              </div>
            )}
          </div>
        ) : (
          <div className="editable-block__json-edit">
            <JSONBlockEditor
              block={block}
              onChange={(updated) => onUpdate(updated as Partial<ContentBlock>)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Simple JSON Block Editor (for complex block types)
// ------------------------------------------------------------------

interface JSONBlockEditorProps {
  block: ContentBlock
  onChange: (block: ContentBlock) => void
}

function JSONBlockEditor({ block, onChange }: JSONBlockEditorProps) {
  const [editing, setEditing] = useState(false)
  const [jsonText, setJsonText] = useState(() => JSON.stringify(block, null, 2))

  useEffect(() => {
    setJsonText(JSON.stringify(block, null, 2))
  }, [block])

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText)
      onChange(parsed as ContentBlock)
      setEditing(false)
    } catch {
      // Invalid JSON, keep editing
    }
  }

  if (editing) {
    return (
      <div className="json-block-editor">
        <textarea
          className="json-block-editor__textarea"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={10}
        />
        <div className="json-block-editor__actions">
          <button
            className="json-block-editor__btn json-block-editor__btn--cancel"
            onClick={() => setEditing(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="json-block-editor__btn json-block-editor__btn--apply"
            onClick={handleApply}
            type="button"
          >
            Apply
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="json-block-editor json-block-editor--preview">
      <pre className="json-block-editor__preview">{JSON.stringify(block, null, 2)}</pre>
      <button
        className="json-block-editor__edit-btn"
        onClick={() => setEditing(true)}
        type="button"
      >
        Edit JSON
      </button>
    </div>
  )
}
