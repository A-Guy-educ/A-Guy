'use client'

import { ExerciseBlockDefaults, generateId } from '@/server/payload/collections/Exercises/defaults'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'
import { useField, useForm } from '@payloadcms/ui'
import { Copy, FileCode, MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react'
import React from 'react'
import { BlockTypeSelector } from './BlockTypeSelector'
import { FullJsonEditor } from './FullJsonEditor'
import { JSONInspector } from './JSONInspector'
import { AxisEditor } from './editors/AxisEditor'
import { FreeResponseEditor } from './editors/FreeResponseEditor'
import { MultiAxisEditor } from './editors/MultiAxisEditor'
import { GeometryEditor } from './editors/GeometryEditor'
import { HtmlBlockEditor } from './editors/HtmlBlockEditor'
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

  // Get blocks array safely
  const blocks: ContentBlock[] = localValue?.blocks || []

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
                onDeleteBlock={handleDeleteBlock}
                onUpdateBlock={handleUpdateBlock}
                onMoveBlock={handleMoveBlock}
                onDuplicateBlock={handleDuplicateBlock}
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
              onDeleteBlock={handleDeleteBlock}
              onUpdateBlock={handleUpdateBlock}
              onMoveBlock={handleMoveBlock}
              onDuplicateBlock={handleDuplicateBlock}
            />
          </div>
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

function getBlockTypeLabel(block: ContentBlock): string {
  if (block.type === 'question_select' && block.variant === 'true_false') return 'True / False'
  if (block.type === 'question_select' && block.variant === 'mcq') return 'Multiple Choice'
  if (block.type === 'question_free_response') return 'Free Response'
  if (block.type === 'question_table') return 'Table Question'
  if (block.type === 'html') return 'HTML Block'
  if (block.type === 'question_matching') return 'Matching'
  if (block.type === 'svg') return 'SVG Image'
  if (block.type === 'media') return 'Media'
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
        canDelete={blockCount > 1}
      >
        <AxisEditor
          block={block as import('@/server/payload/collections/Exercises/types').QuestionAxisBlock}
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
        canMoveUp={blockIndex > 0}
        canMoveDown={blockIndex < blockCount - 1}
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
  onDeleteBlock: (id: string) => void
  onUpdateBlock: (id: string, updates: Partial<ContentBlock>) => void
  onMoveBlock: (id: string, direction: 'up' | 'down') => void
  onDuplicateBlock: (id: string) => void
}

function ContentBlockHeader({
  blockId,
  index,
  blockCount,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
}: {
  blockId: string
  index: number
  blockCount: number
  onMoveBlock: (id: string, direction: 'up' | 'down') => void
  onDuplicateBlock: (id: string) => void
  onDeleteBlock: (id: string) => void
}) {
  return (
    <div className="block-header">
      <div className="block-header-left">
        <span className="block-number">Block {index + 1}</span>
      </div>
      <div className="block-actions">
        <button
          className="block-action-button"
          onClick={() => onMoveBlock(blockId, 'up')}
          disabled={index === 0}
          title="Move up"
          type="button"
        >
          <MoveUp size={14} />
        </button>
        <button
          className="block-action-button"
          onClick={() => onMoveBlock(blockId, 'down')}
          disabled={index === blockCount - 1}
          title="Move down"
          type="button"
        >
          <MoveDown size={14} />
        </button>
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
          onClick={() => onDeleteBlock(blockId)}
          disabled={blockCount === 1}
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
  onDeleteBlock,
  onUpdateBlock,
  onMoveBlock,
  onDuplicateBlock,
}: BlockListProps) {
  return (
    <div className="block-list">
      {blocks.map((block, index) => {
        const isRichText = block.type === 'rich_text'
        const isHtml = block.type === 'html'
        const isMedia = block.type === 'media'

        return (
          <div
            key={block.id}
            className={`block-item ${selectedBlockId === block.id ? 'block-item--selected' : ''}`}
          >
            {isRichText ? (
              <>
                <ContentBlockHeader
                  blockId={block.id}
                  index={index}
                  blockCount={blocks.length}
                  onMoveBlock={onMoveBlock}
                  onDuplicateBlock={onDuplicateBlock}
                  onDeleteBlock={onDeleteBlock}
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
                  blockCount={blocks.length}
                  onMoveBlock={onMoveBlock}
                  onDuplicateBlock={onDuplicateBlock}
                  onDeleteBlock={onDeleteBlock}
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
                  blockCount={blocks.length}
                  onMoveBlock={onMoveBlock}
                  onDuplicateBlock={onDuplicateBlock}
                  onDeleteBlock={onDeleteBlock}
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
                  () => onMoveBlock(block.id, 'up'),
                  () => onMoveBlock(block.id, 'down'),
                  () => onDuplicateBlock(block.id),
                  () => onDeleteBlock(block.id),
                )}
              </div>
            )}
          </div>
        )
      })}

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
