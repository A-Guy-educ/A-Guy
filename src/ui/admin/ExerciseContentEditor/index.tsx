'use client'

import { ExerciseBlockDefaults, generateId } from '@/server/payload/collections/Exercises/defaults'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'
import { useField, useForm } from '@payloadcms/ui'
import { Copy, FileCode, GripVertical, Plus, Trash2, AlertCircle } from 'lucide-react'
import React, { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { BlockTypeSelector } from './BlockTypeSelector'
import { FullJsonEditor } from './FullJsonEditor'
import { JSONInspector } from './JSONInspector'
import { FreeResponseEditor } from './editors/FreeResponseEditor'
import { HtmlBlockEditor } from './editors/HtmlBlockEditor'
import { LatexBlockEditor } from './editors/LatexBlockEditor'
import { InlineRichTextEditor } from './editors/InlineRichTextEditor'
import { MatchingEditor } from './editors/MatchingEditor'
import { McqEditor } from './editors/McqEditor'
import { MediaBlockEditor } from './editors/MediaBlockEditor'
import { QuestionBlockWrapper } from './editors/QuestionBlockWrapper'
import { SvgEditor } from './editors/SvgEditor'
import { TableEditor } from './editors/TableEditor'
import { TrueFalseEditor } from './editors/TrueFalseEditor'
import './index.css'
import { deepCloneBlock } from './utils'

// Lazy-load heavy editors that use jsxgraph to reduce initial client bundle size
const GeometryEditor = dynamic(
  () => import('./editors/GeometryEditor').then((m) => m.GeometryEditor),
  {
    ssr: false,
    loading: () => (
      <div className="p-card-padding text-muted-foreground">Loading geometry editor...</div>
    ),
  },
)
const AxisEditor = dynamic(() => import('./editors/AxisEditor').then((m) => m.AxisEditor), {
  ssr: false,
  loading: () => <div className="p-card-padding text-muted-foreground">Loading axis editor...</div>,
})
const MultiAxisEditor = dynamic(
  () => import('./editors/MultiAxisEditor').then((m) => m.MultiAxisEditor),
  {
    ssr: false,
    loading: () => (
      <div className="p-card-padding text-muted-foreground">Loading multi-axis editor...</div>
    ),
  },
)

/**
 * Exercise Content Editor - Strict Flat Blocks
 *
 * Supports all block types:
 * - rich_text (content blocks)
 * - question_select (true_false and mcq variants)
 * - question_free_response
 * - question_table (table-based with fillable cells)
 */

const DEFAULT_BLOCKS: ContentBlock[] = [
  {
    id: generateId(),
    type: 'rich_text',
    format: 'md-math-v1',
    value: '# Write your question here\n\nExample: Solve for $x$: $2x+3=11$',
    mediaIds: [],
  },
]

export const ExerciseContentEditor: React.FC<{ path: string }> = ({ path }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { value: fieldValue, setValue } = useField<any>({ path })
  const form = useForm()

  // Note: Full JSON editor is available to admin and advanced content editor roles.
  // The access control is enforced at the collection level, so we show the button
  // to anyone who can access the exercise editor. Role check happens on save.
  const isAdvancedUser = true // Show button, server validates on save

  // Local state to hold unsaved changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localValue, setLocalValue] = React.useState<any>(fieldValue)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const isSavingRef = React.useRef(false)
  const modifyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [blockTypeSelectorOpen, setBlockTypeSelectorOpen] = React.useState(false)
  const [insertAtIndex, setInsertAtIndex] = React.useState<number | undefined>(undefined)
  const [mobileView, setMobileView] = React.useState<'editor' | 'json'>('editor')
  const [isMobile, setIsMobile] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastSyncedValueRef = React.useRef<any>(fieldValue)

  // Full JSON mode state
  const [isFullJsonMode, setIsFullJsonMode] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalContentRef = React.useRef<any>(fieldValue)

  // Blocks ref for drag-and-drop (avoids dependency issues)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocksRef = React.useRef<any[]>([])

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [dropTarget, setDropTarget] = React.useState<number | null>(null)

  // Delete confirmation dialog state
  const [deleteConfirmBlockId, setDeleteConfirmBlockId] = React.useState<string | null>(null)
  const [showDeleteWarning, setShowDeleteWarning] = React.useState(false)

  // Helper to update local state and prevent form modification
  const updateLocalValue = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newValue: any) => {
      setLocalValue(newValue)
      setHasUnsavedChanges(true)

      // Cancel any pending setModified(false) calls
      if (modifyTimeoutRef.current) {
        clearTimeout(modifyTimeoutRef.current)
        modifyTimeoutRef.current = null
      }

      // Prevent form from being marked as modified to stop autosave
      if (form.setModified && !isSavingRef.current) {
        modifyTimeoutRef.current = setTimeout(() => {
          if (!isSavingRef.current && form.setModified) {
            form.setModified(false)
          }
          modifyTimeoutRef.current = null
        }, 50)
      }
    },
    [form],
  )

  // Sync local state when field value changes externally
  React.useEffect(() => {
    if (!hasUnsavedChanges && fieldValue !== undefined) {
      if (fieldValue !== lastSyncedValueRef.current) {
        setLocalValue(fieldValue)
        lastSyncedValueRef.current = fieldValue
      }
    }
  }, [fieldValue, hasUnsavedChanges])

  // Detect mobile viewport
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Ensure valid structure on load
  React.useEffect(() => {
    if (!localValue || !localValue.blocks || !Array.isArray(localValue.blocks)) {
      updateLocalValue({ blocks: DEFAULT_BLOCKS })
    }
  }, [localValue, updateLocalValue])

  // Get blocks array safely and keep ref in sync
  const blocks: ContentBlock[] = React.useMemo(() => {
    const b = localValue?.blocks || []
    blocksRef.current = b
    return b
  }, [localValue?.blocks])

  // Open block type selector
  const handleAddBlock = (index?: number) => {
    setInsertAtIndex(index)
    setBlockTypeSelectorOpen(true)
  }

  // Handle block type selection
  const handleBlockTypeSelected = (blockType: string) => {
    // Create block using factory defaults
    const newBlock = ExerciseBlockDefaults[blockType]() as ContentBlock

    const newBlocks = [...blocks]
    if (insertAtIndex !== undefined) {
      newBlocks.splice(insertAtIndex + 1, 0, newBlock)
    } else {
      newBlocks.push(newBlock)
    }

    updateLocalValue({ blocks: newBlocks })
    setSelectedBlockId(newBlock.id)
  }

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    const newBlocks = blocks.filter((b) => b.id !== blockId)

    // Ensure at least one block
    if (newBlocks.length === 0) {
      newBlocks.push({
        id: generateId(),
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      })
    }

    updateLocalValue({ blocks: newBlocks })

    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
    }
  }

  // Update block
  const handleUpdateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    const newBlocks = blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
    updateLocalValue({ blocks: newBlocks })
  }

  // Move block
  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex((b) => b.id === blockId)
    if (index === -1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= blocks.length) return

    const newBlocks = [...blocks]
    const [movedBlock] = newBlocks.splice(index, 1)
    newBlocks.splice(targetIndex, 0, movedBlock)

    updateLocalValue({ blocks: newBlocks })
  }

  // Duplicate block
  const handleDuplicateBlock = (blockId: string) => {
    const index = blocks.findIndex((b) => b.id === blockId)
    if (index === -1) return

    const originalBlock = blocks[index]
    const duplicatedBlock = deepCloneBlock(originalBlock)

    const newBlocks = [...blocks]
    // Insert duplicate right after the original
    newBlocks.splice(index + 1, 0, duplicatedBlock)

    updateLocalValue({ blocks: newBlocks })
    setSelectedBlockId(duplicatedBlock.id)
  }

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(idx)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, toIdx: number) => {
      e.preventDefault()
      const fromIdx = dragIndex
      setDragIndex(null)
      setDropTarget(null)
      if (fromIdx !== null && fromIdx !== toIdx) {
        const currentBlocks = blocksRef.current
        const newBlocks = [...currentBlocks]
        const [movedBlock] = newBlocks.splice(fromIdx, 1)
        newBlocks.splice(toIdx, 0, movedBlock)
        updateLocalValue({ blocks: newBlocks })
      }
    },
    [dragIndex, updateLocalValue],
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDropTarget(null)
  }, [])

  // Delete block with confirmation
  const confirmDeleteBlock = (blockId: string) => {
    if (blocks.length === 1) {
      setShowDeleteWarning(true)
      return
    }
    setDeleteConfirmBlockId(blockId)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmBlockId) {
      handleDeleteBlock(deleteConfirmBlockId)
      setDeleteConfirmBlockId(null)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmBlockId(null)
    setShowDeleteWarning(false)
  }

  // Apply JSON changes
  const handleJsonApply = (updatedBlock: ContentBlock) => {
    if (!selectedBlockId) return
    handleUpdateBlock(selectedBlockId, updatedBlock)
  }

  // Save changes
  const handleSave = async () => {
    if (modifyTimeoutRef.current) {
      clearTimeout(modifyTimeoutRef.current)
      modifyTimeoutRef.current = null
    }

    isSavingRef.current = true
    setIsSaving(true)

    try {
      setValue(localValue)
      await new Promise((resolve) => setTimeout(resolve, 150))

      if (form.setModified) {
        form.setModified(true)
      }

      await new Promise((resolve) => setTimeout(resolve, 200))

      const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
      if (saveButton && !saveButton.disabled) {
        saveButton.click()
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      setHasUnsavedChanges(false)
      lastSyncedValueRef.current = localValue
    } finally {
      setIsSaving(false)
      setTimeout(() => {
        isSavingRef.current = false
      }, 2000)
    }
  }

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null

  if (!localValue) {
    return <div className="p-card-padding-sm text-muted-foreground">Loading editor...</div>
  }

  // Handle entering full JSON mode
  const handleEnterFullJsonMode = () => {
    originalContentRef.current = fieldValue
    setIsFullJsonMode(true)
  }

  // Handle applying changes from full JSON mode
  const handleFullJsonApply = (newContent: unknown) => {
    updateLocalValue(newContent)
    setIsFullJsonMode(false)
    // Trigger save
    setValue(newContent)
    setTimeout(() => {
      if (form.setModified) {
        form.setModified(true)
      }
      const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
      if (saveButton && !saveButton.disabled) {
        saveButton.click()
      }
    }, 100)
  }

  // Handle cancelling full JSON mode
  const handleFullJsonCancel = () => {
    setIsFullJsonMode(false)
    // Reset to original
    setLocalValue(originalContentRef.current)
  }

  // Render full JSON mode
  if (isFullJsonMode && isAdvancedUser) {
    return (
      <FullJsonEditor
        content={localValue}
        originalContent={originalContentRef.current}
        onApply={handleFullJsonApply}
        onCancel={handleFullJsonCancel}
      />
    )
  }

  return (
    <div className="exercise-content-editor">
      <div className="editor-header">
        <div>
          <h3>Exercise Content</h3>
          <p className="editor-description">
            {isFullJsonMode
              ? 'Full JSON editing mode'
              : 'Flat list of content blocks. Each block is Markdown with LaTeX math support.'}
          </p>
        </div>
        <div className="editor-header-actions">
          {hasUnsavedChanges && !isFullJsonMode && (
            <button
              className="editor-save-button"
              onClick={handleSave}
              title="Save changes"
              type="button"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {isAdvancedUser && (
            <button
              className={`icon-button ${isFullJsonMode ? 'active' : ''}`}
              onClick={handleEnterFullJsonMode}
              title="Full JSON Editor"
              type="button"
            >
              <FileCode size={16} />
            </button>
          )}
          <div className="editor-badge">{isFullJsonMode ? 'JSON' : 'Flat Blocks'}</div>
        </div>
      </div>

      {isMobile ? (
        <>
          <div className="editor-mobile-tabs">
            <button
              className={`editor-mobile-tab ${mobileView === 'editor' ? 'active' : ''}`}
              onClick={() => setMobileView('editor')}
            >
              Editor
            </button>
            <button
              className={`editor-mobile-tab ${mobileView === 'json' ? 'active' : ''}`}
              onClick={() => setMobileView('json')}
            >
              JSON
            </button>
          </div>
          {mobileView === 'editor' ? (
            <div className="editor-main">
              <BlockList
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelect={setSelectedBlockId}
                onAddBlock={handleAddBlock}
                onUpdateBlock={handleUpdateBlock}
                onMoveBlock={handleMoveBlock}
                onDuplicateBlock={handleDuplicateBlock}
                dragIndex={dragIndex}
                dropTarget={dropTarget}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onRequestDelete={confirmDeleteBlock}
              />
            </div>
          ) : (
            <div className="editor-json-panel editor-json-panel--mobile">
              <JSONInspector
                block={selectedBlock}
                mode="edit"
                onApply={handleJsonApply}
                onClose={() => setMobileView('editor')}
              />
            </div>
          )}
        </>
      ) : (
        <div className="editor-layout">
          <div className="editor-main">
            <BlockList
              blocks={blocks}
              selectedBlockId={selectedBlockId}
              onSelect={setSelectedBlockId}
              onAddBlock={handleAddBlock}
              onUpdateBlock={handleUpdateBlock}
              onMoveBlock={handleMoveBlock}
              onDuplicateBlock={handleDuplicateBlock}
              dragIndex={dragIndex}
              dropTarget={dropTarget}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onRequestDelete={confirmDeleteBlock}
            />
          </div>
        </div>
      )}

      <BlockTypeSelector
        isOpen={blockTypeSelectorOpen}
        onClose={() => setBlockTypeSelectorOpen(false)}
        onSelect={handleBlockTypeSelected}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmBlockId && (
        <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <AlertCircle size={20} />
              <h3>Delete Block?</h3>
            </div>
            <p className="delete-confirm-body">
              This action cannot be undone. The block will be permanently deleted.
            </p>
            <div className="delete-confirm-actions">
              <button className="delete-confirm-cancel" onClick={handleCancelDelete} type="button">
                Cancel
              </button>
              <button className="delete-confirm-delete" onClick={handleConfirmDelete} type="button">
                Delete Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Dialog */}
      {showDeleteWarning && (
        <div className="delete-confirm-overlay" onClick={() => setShowDeleteWarning(false)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header delete-confirm-header--warning">
              <AlertCircle size={20} />
              <h3>Cannot Delete Last Block</h3>
            </div>
            <p className="delete-confirm-body">
              An exercise must have at least one block. Please add a new block before deleting this
              one.
            </p>
            <div className="delete-confirm-actions">
              <button
                className="delete-confirm-cancel"
                onClick={() => setShowDeleteWarning(false)}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getBlockTypeLabel(block: ContentBlock): string {
  if (block.type === 'question_select' && block.variant === 'true_false') return 'True / False'
  if (block.type === 'question_select' && block.variant === 'mcq') return 'Multiple Choice'
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

function renderQuestionEditor(
  block: ContentBlock,
  onChange: (block: ContentBlock) => void,
  blockIndex: number,
  blockCount: number,
  onMoveUp: () => void,
  onMoveDown: () => void,
  onDuplicate: () => void,
  onDelete: () => void,
  canMoveUp: boolean,
  canMoveDown: boolean,
): React.ReactNode {
  if (block.type === 'question_select' && block.variant === 'true_false') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <TrueFalseEditor
          block={
            block as import('@/server/payload/collections/Exercises/types').QuestionSelectTrueFalseBlock
          }
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'question_select' && block.variant === 'mcq') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <McqEditor
          block={
            block as import('@/server/payload/collections/Exercises/types').QuestionSelectMcqBlock
          }
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'question_free_response') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <FreeResponseEditor
          block={
            block as import('@/server/payload/collections/Exercises/types').QuestionFreeResponseBlock
          }
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'question_table') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <TableEditor
          block={block as import('@/server/payload/collections/Exercises/types').QuestionTableBlock}
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'question_matching') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <MatchingEditor
          block={
            block as import('@/server/payload/collections/Exercises/types').QuestionMatchingBlock
          }
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'svg') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <SvgEditor
          block={block as import('@/server/payload/collections/Exercises/types').SvgBlock}
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'question_geometry') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <GeometryEditor
          block={
            block as import('@/server/payload/collections/Exercises/types').QuestionGeometryBlock
          }
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'question_axis') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <AxisEditor
          block={block as import('@/server/payload/collections/Exercises/types').QuestionAxisBlock}
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === 'latex') {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <LatexBlockEditor
          block={block as import('@/server/payload/collections/Exercises/types').LatexBlock}
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  if (block.type === ('question_multi_axis' as string)) {
    return (
      <QuestionBlockWrapper
        blockType={getBlockTypeLabel(block)}
        block={block}
        onBlockChange={onChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        canDelete={blockCount > 1}
      >
        <MultiAxisEditor
          block={
            block as import('@/server/payload/collections/Exercises/types').QuestionMultiAxisBlock
          }
          onChange={onChange}
        />
      </QuestionBlockWrapper>
    )
  }
  return <JSONInspector block={block} mode="edit" onApply={onChange} />
}

interface BlockListProps {
  blocks: ContentBlock[]
  selectedBlockId: string | null
  onSelect: (id: string) => void
  onAddBlock: (index?: number) => void
  onUpdateBlock: (id: string, updates: Partial<ContentBlock>) => void
  onMoveBlock: (id: string, direction: 'up' | 'down') => void
  onDuplicateBlock: (id: string) => void
  // Drag-and-drop props
  dragIndex: number | null
  dropTarget: number | null
  onDragStart: (e: React.DragEvent, idx: number) => void
  onDragOver: (e: React.DragEvent, idx: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, toIdx: number) => void
  onDragEnd: () => void
  // Delete confirmation
  onRequestDelete: (id: string) => void
}

function ContentBlockHeader({
  blockId,
  index,
  onDuplicateBlock,
  onRequestDelete,
}: {
  blockId: string
  index: number
  onDuplicateBlock: (id: string) => void
  onRequestDelete: (id: string) => void
}) {
  return (
    <div className="block-header">
      <div className="block-header-left">
        <span className="block-number">Block {index + 1}</span>
      </div>
      <div className="block-actions">
        <button
          className="block-action-button"
          onClick={() => onDuplicateBlock(blockId)}
          title="Duplicate block"
          type="button"
        >
          <Copy size={14} />
        </button>
        <button
          className="block-action-button block-action-button--danger"
          onClick={() => onRequestDelete(blockId)}
          title="Delete block"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function BlockList({
  blocks,
  selectedBlockId,
  onSelect,
  onAddBlock,
  onUpdateBlock,
  onDuplicateBlock,
  dragIndex,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRequestDelete,
}: BlockListProps) {
  return (
    <div className="block-list">
      {blocks.map((block, index) => {
        const isRichText = block.type === 'rich_text'
        const isHtml = block.type === 'html'
        const isMedia = block.type === 'media'

        return (
          <React.Fragment key={block.id}>
            {/* Between-block add button */}
            <div className="between-block-add">
              <button
                className="between-block-add-button"
                onClick={() => onAddBlock(index - 1)}
                type="button"
                title="Add block above"
              >
                <Plus size={12} />
              </button>
            </div>

            <div
              className={`block-item ${selectedBlockId === block.id ? 'block-item--selected' : ''} ${
                dragIndex === index ? 'block-item--dragging' : ''
              } ${dropTarget === index ? 'block-item--drop-target' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
            >
              <div className="block-drag-handle" title="Drag to reorder">
                <GripVertical size={16} />
              </div>

              {isRichText ? (
                <>
                  <ContentBlockHeader
                    blockId={block.id}
                    index={index}
                    onDuplicateBlock={onDuplicateBlock}
                    onRequestDelete={onRequestDelete}
                  />
                  <div className="block-content">
                    <div onClick={() => onSelect(block.id)} onFocus={() => onSelect(block.id)}>
                      <InlineRichTextEditor
                        value={{
                          value: block.value,
                          mediaIds: block.mediaIds || [],
                          type: 'rich_text',
                          format: 'md-math-v1',
                        }}
                        onChange={(newValue: InlineRichText) =>
                          onUpdateBlock(block.id, {
                            value: newValue.value,
                            mediaIds: newValue.mediaIds,
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : isMedia ? (
                <>
                  <ContentBlockHeader
                    blockId={block.id}
                    index={index}
                    onDuplicateBlock={onDuplicateBlock}
                    onRequestDelete={onRequestDelete}
                  />
                  <div className="block-content" onClick={() => onSelect(block.id)}>
                    <MediaBlockEditor
                      block={
                        block as import('@/server/payload/collections/Exercises/types').MediaBlock
                      }
                      onChange={(updatedBlock) => {
                        onUpdateBlock(block.id, updatedBlock)
                      }}
                    />
                  </div>
                </>
              ) : isHtml ? (
                <>
                  <ContentBlockHeader
                    blockId={block.id}
                    index={index}
                    onDuplicateBlock={onDuplicateBlock}
                    onRequestDelete={onRequestDelete}
                  />
                  <div className="block-content" onClick={() => onSelect(block.id)}>
                    <HtmlBlockEditor
                      block={
                        block as import('@/server/payload/collections/Exercises/types').HtmlBlock
                      }
                      onChange={(updatedBlock) => onUpdateBlock(block.id, updatedBlock)}
                    />
                  </div>
                </>
              ) : (
                <div className="question-block-json-editor">
                  {renderQuestionEditor(
                    block,
                    (updatedBlock) => onUpdateBlock(block.id, updatedBlock),
                    index,
                    blocks.length,
                    () => {},
                    () => {},
                    () => onDuplicateBlock(block.id),
                    () => onRequestDelete(block.id),
                    false, // canMoveUp - using drag-and-drop instead
                    false, // canMoveDown - using drag-and-drop instead
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        )
      })}

      {/* Add block button at the end */}
      <div className="between-block-add">
        <button
          className="between-block-add-button"
          onClick={() => onAddBlock(blocks.length - 1)}
          type="button"
          title="Add block below"
        >
          <Plus size={12} />
        </button>
      </div>

      <button className="add-block-button" onClick={() => onAddBlock()} type="button">
        <Plus size={16} />
        Add Block
      </button>

      {blocks.length === 0 && (
        <div className="empty-state">
          <p>No blocks yet.</p>
          <button onClick={() => onAddBlock()} type="button">
            Add First Block
          </button>
        </div>
      )}
    </div>
  )
}
