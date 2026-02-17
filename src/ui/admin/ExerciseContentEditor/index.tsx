'use client'

import type { Media } from '@/payload-types'
import { ExerciseBlockDefaults, generateId } from '@/shared/exercise-content/defaults'
import type { ContentBlock } from '@/shared/exercise-content/types'
import { useField, useForm } from '@payloadcms/ui'
import { Code, Copy, Image as ImageIcon, MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import React from 'react'
import { BlockTypeSelector } from './BlockTypeSelector'
import './index.css'
import { JSONInspector } from './JSONInspector'
import { MediaPicker } from './MediaPicker'
import { RichTextEditor } from './RichTextEditor'
import { FreeResponseEditor } from './editors/FreeResponseEditor'
import { McqEditor } from './editors/McqEditor'
import { QuestionBlockWrapper } from './editors/QuestionBlockWrapper'
import { TableEditor } from './editors/TableEditor'
import { TrueFalseEditor } from './editors/TrueFalseEditor'
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

  // Local state to hold unsaved changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localValue, setLocalValue] = React.useState<any>(fieldValue)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const isSavingRef = React.useRef(false)
  const modifyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [isJsonPanelOpen, setIsJsonPanelOpen] = React.useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false)
  const [currentBlockForMedia, setCurrentBlockForMedia] = React.useState<string | null>(null)
  const [blockTypeSelectorOpen, setBlockTypeSelectorOpen] = React.useState(false)
  const [insertAtIndex, setInsertAtIndex] = React.useState<number | undefined>(undefined)
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('exercise-editor-json-panel-width')
      return saved ? parseInt(saved, 10) : 400
    }
    return 400
  })
  const [isResizing, setIsResizing] = React.useState(false)
  const [mobileView, setMobileView] = React.useState<'editor' | 'json'>('editor')
  const [isMobile, setIsMobile] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastSyncedValueRef = React.useRef<any>(fieldValue)

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

  // Open media picker for a block
  const handleOpenMediaPicker = (blockId: string) => {
    setCurrentBlockForMedia(blockId)
    setMediaPickerOpen(true)
  }

  // Save media selection
  const handleMediaSave = (mediaIds: string[]) => {
    if (currentBlockForMedia) {
      handleUpdateBlock(currentBlockForMedia, { mediaIds })
    }
  }

  // Remove single media from block
  const handleRemoveMedia = (blockId: string, mediaId: string) => {
    const block = blocks.find((b) => b.id === blockId)
    if (!block || block.type !== 'rich_text') return
    const newMediaIds = (block.mediaIds || []).filter((id: string) => id !== mediaId)
    handleUpdateBlock(blockId, { mediaIds: newMediaIds })
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

  // Handle resizing
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.editor-layout') as HTMLElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const newWidth = containerRect.right - e.clientX
      const minWidth = 300
      const maxWidth = containerRect.width * 0.5

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setJsonPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('exercise-editor-json-panel-width', jsonPanelWidth.toString())
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, jsonPanelWidth])

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null

  if (!localValue) {
    return <div className="p-4 text-muted-foreground">Loading editor...</div>
  }

  return (
    <div className="exercise-content-editor">
      <div className="editor-header">
        <div>
          <h3>Exercise Content</h3>
          <p className="editor-description">
            Flat list of content blocks. Each block is Markdown with LaTeX math support.
          </p>
        </div>
        <div className="editor-header-actions">
          {hasUnsavedChanges && (
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
          <button
            className={`icon-button ${isJsonPanelOpen ? 'active' : ''}`}
            onClick={() => setIsJsonPanelOpen(!isJsonPanelOpen)}
            title={isJsonPanelOpen ? 'Hide JSON' : 'Show JSON'}
            type="button"
          >
            <Code size={16} />
          </button>
          <div className="editor-badge">Flat Blocks</div>
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
                onOpenMediaPicker={handleOpenMediaPicker}
                onRemoveMedia={handleRemoveMedia}
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
              onOpenMediaPicker={handleOpenMediaPicker}
              onRemoveMedia={handleRemoveMedia}
            />
          </div>

          {isJsonPanelOpen && (
            <>
              <div
                className="editor-splitter"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizing(true)
                }}
              />
              <div className="editor-json-panel" style={{ width: `${jsonPanelWidth}px` }}>
                <JSONInspector block={selectedBlock} mode="edit" onApply={handleJsonApply} />
              </div>
            </>
          )}
        </div>
      )}

      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        selectedMediaIds={
          currentBlockForMedia
            ? (() => {
                const block = blocks.find((b) => b.id === currentBlockForMedia)
                return block?.type === 'rich_text' ? block.mediaIds || [] : []
              })()
            : []
        }
        onSave={handleMediaSave}
      />

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
          block={block as import('@/shared/exercise-content/types').QuestionSelectTrueFalseBlock}
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
          block={block as import('@/shared/exercise-content/types').QuestionSelectMcqBlock}
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
          block={block as import('@/shared/exercise-content/types').QuestionFreeResponseBlock}
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
          block={block as import('@/shared/exercise-content/types').QuestionTableBlock}
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
  onOpenMediaPicker: (blockId: string) => void
  onRemoveMedia: (blockId: string, mediaId: string) => void
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
  onOpenMediaPicker,
  onRemoveMedia,
}: BlockListProps) {
  return (
    <div className="block-list">
      {blocks.map((block, index) => {
        const isRichText = block.type === 'rich_text'

        return (
          <div
            key={block.id}
            className={`block-item ${selectedBlockId === block.id ? 'block-item--selected' : ''}`}
          >
            {isRichText ? (
              <>
                <div className="block-header">
                  <div className="block-header-left">
                    <span className="block-number">Block {index + 1}</span>
                  </div>
                  <div className="block-actions">
                    <button
                      className="block-action-button"
                      onClick={() => onMoveBlock(block.id, 'up')}
                      disabled={index === 0}
                      title="Move up"
                      type="button"
                    >
                      <MoveUp size={14} />
                    </button>
                    <button
                      className="block-action-button"
                      onClick={() => onMoveBlock(block.id, 'down')}
                      disabled={index === blocks.length - 1}
                      title="Move down"
                      type="button"
                    >
                      <MoveDown size={14} />
                    </button>
                    <button
                      className="block-action-button"
                      onClick={() => onDuplicateBlock(block.id)}
                      title="Duplicate block"
                      type="button"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="block-action-button block-action-button--danger"
                      onClick={() => onDeleteBlock(block.id)}
                      disabled={blocks.length === 1}
                      title="Delete block"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="block-content">
                  <div onClick={() => onSelect(block.id)} onFocus={() => onSelect(block.id)}>
                    <RichTextEditor
                      value={block.value}
                      onChange={(value) => onUpdateBlock(block.id, { value })}
                    />
                  </div>
                </div>
                <div className="block-media-section">
                  <button
                    type="button"
                    className="block-media-button"
                    onClick={() => onOpenMediaPicker(block.id)}
                    title="Attach media"
                  >
                    <ImageIcon size={14} />
                    <span>
                      {block.mediaIds && block.mediaIds.length > 0
                        ? `${block.mediaIds.length} media attached`
                        : 'Attach media'}
                    </span>
                  </button>

                  {block.mediaIds && block.mediaIds.length > 0 && (
                    <BlockMediaDisplay
                      blockId={block.id}
                      mediaIds={block.mediaIds}
                      onRemoveMedia={onRemoveMedia}
                    />
                  )}
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

interface BlockMediaDisplayProps {
  blockId: string
  mediaIds: string[]
  onRemoveMedia: (blockId: string, mediaId: string) => void
}

function BlockMediaDisplay({ blockId, mediaIds, onRemoveMedia }: BlockMediaDisplayProps) {
  const [mediaItems, setMediaItems] = React.useState<Media[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true)
      try {
        const fetchPromises = mediaIds.map((id) =>
          fetch(`/api/media/${id}`).then((res) => (res.ok ? res.json() : null)),
        )
        const results = await Promise.all(fetchPromises)
        setMediaItems(results.filter((item): item is Media => item !== null))
      } catch (err) {
        console.error('Failed to fetch media:', err)
      } finally {
        setLoading(false)
      }
    }

    if (mediaIds.length > 0) {
      fetchMedia()
    }
  }, [mediaIds])

  if (loading) {
    return <div className="block-media-loading">Loading media...</div>
  }

  if (mediaItems.length === 0) {
    return null
  }

  return (
    <div className="block-media-preview">
      {mediaItems.map((media) => {
        // Cast to any to bypass strict type checking for blob storage sizes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaAny = media as any
        const thumbnailUrl = mediaAny.sizes?.thumbnail?.url || media.url
        return (
          <div key={media.id} className="media-thumbnail-preview">
            {thumbnailUrl && (
              <Image
                src={thumbnailUrl}
                alt={media.alt || media.filename || 'Media'}
                width={150}
                height={150}
                style={{ objectFit: 'cover' }}
              />
            )}
            <button
              type="button"
              className="media-thumbnail-remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveMedia(blockId, media.id)
              }}
              title="Remove media"
            >
              ×
            </button>
            <div className="media-thumbnail-name">{media.filename}</div>
          </div>
        )
      })}
    </div>
  )
}
