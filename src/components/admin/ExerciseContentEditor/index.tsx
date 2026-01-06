'use client'

import React from 'react'
import { useField, useForm } from '@payloadcms/ui'
import { Code, Plus, Trash2, MoveUp, MoveDown, Image } from 'lucide-react'
import { RichTextEditor } from './RichTextEditor'
import { JSONInspector } from './JSONInspector'
import { MediaPicker } from './MediaPicker'
import { BlockTypeSelector } from './BlockTypeSelector'
import type { ContentBlock } from '@/collections/Exercises'
import { ExerciseBlockDefaults } from '@/collections/Exercises'
import type { Media } from '@/payload-types'
import { generateId } from './utils'
import './index.css'

/**
 * Exercise Content Editor - Strict Flat Blocks
 *
 * Supports all block types:
 * - rich_text (content blocks)
 * - question_select
 * - question_mcq
 * - question_free_response
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
  }, [])

  // Get blocks array safely
  const blocks: ContentBlock[] = localValue?.blocks || []

  // Open block type selector
  const handleAddBlock = (index?: number) => {
    setInsertAtIndex(index)
    setBlockTypeSelectorOpen(true)
  }

  // Handle block type selection
  const handleBlockTypeSelected = (blockType: ContentBlock['type']) => {
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

    // Open JSON panel for question blocks
    if (blockType !== 'rich_text') {
      setIsJsonPanelOpen(true)
    }
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

interface BlockListProps {
  blocks: ContentBlock[]
  selectedBlockId: string | null
  onSelect: (id: string) => void
  onAddBlock: (index?: number) => void
  onDeleteBlock: (id: string) => void
  onUpdateBlock: (id: string, updates: Partial<ContentBlock>) => void
  onMoveBlock: (id: string, direction: 'up' | 'down') => void
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
  onOpenMediaPicker,
  onRemoveMedia,
}: BlockListProps) {
  return (
    <div className="block-list">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={`block-item ${selectedBlockId === block.id ? 'block-item--selected' : ''}`}
        >
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
                onClick={() => onAddBlock(index)}
                title="Add block below"
                type="button"
              >
                <Plus size={14} />
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
            {block.type === 'rich_text' ? (
              <div onClick={() => onSelect(block.id)} onFocus={() => onSelect(block.id)}>
                <RichTextEditor
                  value={block.value}
                  onChange={(value) => onUpdateBlock(block.id, { value })}
                />
              </div>
            ) : (
              <div className="question-block-json-editor">
                <div className="question-block-type-badge">
                  {block.type === 'question_select' && 'Select Question'}
                  {block.type === 'question_mcq' && 'Multiple Choice Question'}
                  {block.type === 'question_free_response' && 'Free Response Question'}
                </div>
                <JSONInspector
                  block={block}
                  mode="edit"
                  onApply={(updatedBlock) => onUpdateBlock(block.id, updatedBlock)}
                />
              </div>
            )}
          </div>

          {block.type === 'rich_text' && (
            <div className="block-media-section">
              <button
                type="button"
                className="block-media-button"
                onClick={() => onOpenMediaPicker(block.id)}
                title="Attach media"
              >
                <Image size={14} />
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
          )}
        </div>
      ))}

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
        const thumbnailUrl = media.sizes?.thumbnail?.url || media.url
        return (
          <div key={media.id} className="media-thumbnail-preview">
            {thumbnailUrl && (
              <img src={thumbnailUrl} alt={media.alt || media.filename || 'Media'} />
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
