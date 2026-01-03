'use client'

import React from 'react'
import { useField, useForm } from '@payloadcms/ui'
import { Code, Plus, Trash2, MoveUp, MoveDown } from 'lucide-react'
import { RichTextEditor } from './RichTextEditor'
import { JSONInspector } from './JSONInspector'
import type { RichTextBlock } from '@/contracts'
import { generateId } from './utils'
import './index.css'

/**
 * Exercise Content Editor - Strict Flat Blocks
 *
 * Reads/writes ONLY: { blocks: RichTextBlock[] }
 * NO containers, NO hierarchy, NO legacy support.
 */

const DEFAULT_BLOCKS: RichTextBlock[] = [
  {
    id: generateId(),
    type: 'rich_text',
    format: 'md-math-v1',
    value: '# Write your question here\n\nExample: Solve for $x$: $2x+3=11$',
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
  const blocks: RichTextBlock[] = localValue?.blocks || []

  // Add new block
  const handleAddBlock = (index?: number) => {
    const newBlock: RichTextBlock = {
      id: generateId(),
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
    }

    const newBlocks = [...blocks]
    if (index !== undefined) {
      newBlocks.splice(index + 1, 0, newBlock)
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
      })
    }

    updateLocalValue({ blocks: newBlocks })

    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
    }
  }

  // Update block
  const handleUpdateBlock = (blockId: string, updates: Partial<RichTextBlock>) => {
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
  const handleJsonApply = (updatedBlock: RichTextBlock) => {
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
    </div>
  )
}

interface BlockListProps {
  blocks: RichTextBlock[]
  selectedBlockId: string | null
  onSelect: (id: string) => void
  onAddBlock: (index?: number) => void
  onDeleteBlock: (id: string) => void
  onUpdateBlock: (id: string, updates: Partial<RichTextBlock>) => void
  onMoveBlock: (id: string, direction: 'up' | 'down') => void
}

function BlockList({
  blocks,
  selectedBlockId,
  onSelect,
  onAddBlock,
  onDeleteBlock,
  onUpdateBlock,
  onMoveBlock,
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
          <div
            className="block-content"
            onClick={() => onSelect(block.id)}
            onFocus={() => onSelect(block.id)}
          >
            <RichTextEditor
              value={block.value}
              onChange={(value) => onUpdateBlock(block.id, { value })}
            />
          </div>
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
