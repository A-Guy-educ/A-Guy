'use client'

import React from 'react'
import { useField, useForm } from '@payloadcms/ui'
import { Code } from 'lucide-react'
import { BlockTree } from './BlockTree'
import { Breadcrumb } from './Breadcrumb'
import { JSONInspector } from './JSONInspector'
import { migrateV1ToV2 } from '@/contracts/exercise/content'
import type { Block } from '@/contracts/exercise/content'
import {
  generateId,
  addBlockAsChild,
  addBlockAsSibling,
  removeBlock,
  updateBlock,
  moveBlockInParent,
  findBlockById,
  findBlockPath,
  flattenBlocks,
} from './utils'
import './index.css'

const DEFAULT_STEM: Block[] = [
  {
    id: 'container-1',
    type: 'container',
    title: 'Section 1',
    children: [
      {
        id: 'block-1',
        type: 'rich_text',
        format: 'md-math-v1',
        value: '# Write your question here\n\nExample: Solve for $x$: $2x+3=11$',
      },
    ],
  },
]

export const ExerciseContentEditor: React.FC<{ path: string }> = ({ path }) => {
  const { value: fieldValue, setValue } = useField<any>({ path })
  const form = useForm()
  // Local state to hold unsaved changes
  const [localValue, setLocalValue] = React.useState<any>(fieldValue)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const isSavingRef = React.useRef(false)

  // Track timeout IDs so we can cancel them if needed
  const modifyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Helper to update local state and prevent form modification
  const updateLocalValue = React.useCallback(
    (newValue: any) => {
      setLocalValue(newValue)
      setHasUnsavedChanges(true)

      // Cancel any pending setModified(false) calls
      if (modifyTimeoutRef.current) {
        clearTimeout(modifyTimeoutRef.current)
        modifyTimeoutRef.current = null
      }

      // Prevent form from being marked as modified to stop autosave
      // But only if we're not currently saving
      if (form.setModified && !isSavingRef.current) {
        // Use a small delay to ensure this runs after any form state updates
        // but before Payload's autosave mechanism kicks in
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
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [collapsedBlockIds, setCollapsedBlockIds] = React.useState<Set<string>>(new Set())
  const [manuallyCollapsedIds, setManuallyCollapsedIds] = React.useState<Set<string>>(new Set())
  const [isJsonPanelOpen, setIsJsonPanelOpen] = React.useState(false)
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('exercise-editor-json-panel-width')
      return saved ? parseInt(saved, 10) : 400
    }
    return 400
  })
  const [isResizing, setIsResizing] = React.useState(false)
  const [lastUpdatedBy, setLastUpdatedBy] = React.useState<'richText' | 'jsonEditor' | null>(null)
  const [mobileView, setMobileView] = React.useState<'editor' | 'json'>('editor')
  const [isMobile, setIsMobile] = React.useState(false)
  const lastSyncedValueRef = React.useRef<any>(fieldValue)

  // Sync local state when field value changes externally (e.g., form reset or initial load)
  // Only sync if there are no unsaved changes to avoid overwriting user edits
  React.useEffect(() => {
    if (!hasUnsavedChanges && fieldValue !== undefined) {
      // Only update if the field value actually changed
      if (fieldValue !== lastSyncedValueRef.current) {
        setLocalValue(fieldValue)
        lastSyncedValueRef.current = fieldValue
      }
    }
  }, [fieldValue, hasUnsavedChanges])

  // Use localValue for all operations
  const value = localValue

  // Detect mobile viewport
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Ensure valid structure on load and migrate v1 to v2
  React.useEffect(() => {
    if (!value || !value.stem || !Array.isArray(value.stem)) {
      const defaultContent = {
        contentSchemaVersion: 2,
        stem: DEFAULT_STEM,
      }
      updateLocalValue(defaultContent)
      return
    }

    // Migrate v1 to v2 if needed
    if (value.contentSchemaVersion === 1) {
      const migrated = migrateV1ToV2(value)
      updateLocalValue(migrated)
    }
  }, [value])

  // Auto-expand active path (selected block and all ancestors)
  // Only runs when selection changes, not on manual collapse/expand
  React.useEffect(() => {
    if (!selectedBlockId || !value?.stem) {
      // If no selection, collapse all containers by default (except manually expanded ones)
      const allBlocks = flattenBlocks(value?.stem || [])
      const allContainerIds = allBlocks
        .filter((block) => block.type === 'container')
        .map((block) => block.id)
      const next = new Set<string>()
      allContainerIds.forEach((id) => {
        // Respect manual collapse state
        if (manuallyCollapsedIds.has(id)) {
          next.add(id)
        }
      })
      setCollapsedBlockIds(next)
      return
    }

    const activePath = findBlockPath(value.stem, selectedBlockId)
    setCollapsedBlockIds((prev) => {
      const next = new Set<string>()
      // Collapse all containers except those in active path
      const allBlocks = flattenBlocks(value.stem)
      allBlocks.forEach((block) => {
        if (block.type === 'container') {
          // Only expand if it's in the active path (ancestor of selected)
          // But respect manual collapse state
          if (!activePath.includes(block.id) || manuallyCollapsedIds.has(block.id)) {
            next.add(block.id)
          }
        }
      })
      return next
    })
  }, [selectedBlockId, value?.stem, manuallyCollapsedIds])

  const handleSelectBlock = (blockId: string) => {
    // Selection is UI-only, does NOT trigger save
    setSelectedBlockId(blockId)
  }

  const handleToggleCollapse = (blockId: string) => {
    // Toggle collapse state - this is UI-only, does NOT trigger save
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev)
      const isCurrentlyCollapsed = next.has(blockId)

      if (isCurrentlyCollapsed) {
        next.delete(blockId)
        // Remove from manual collapse tracking if user expands
        setManuallyCollapsedIds((manual) => {
          const newManual = new Set(manual)
          newManual.delete(blockId)
          return newManual
        })
      } else {
        next.add(blockId)
        // Track that user manually collapsed this
        setManuallyCollapsedIds((manual) => {
          const newManual = new Set(manual)
          newManual.add(blockId)
          return newManual
        })
      }

      return next
    })
    // Explicitly do NOT call setValue - collapse/expand is UI state only
  }

  const handleAddBlock = (
    parentId: string | null,
    blockType: 'container' | 'rich_text',
    position: 'inside' | 'below',
  ) => {
    if (!value || !value.stem) return

    const newBlock: Block =
      blockType === 'container'
        ? {
            id: generateId(),
            type: 'container',
            title: 'New Container',
            children: [],
          }
        : {
            id: generateId(),
            type: 'rich_text',
            format: 'md-math-v1',
            value: '',
          }

    let updatedStem: Block[]
    if (position === 'inside' && parentId) {
      updatedStem = addBlockAsChild(parentId, newBlock, value.stem)
      // New containers start expanded
      if (blockType === 'container') {
        setCollapsedBlockIds((prev) => {
          const next = new Set(prev)
          next.delete(newBlock.id)
          return next
        })
      }
    } else if (position === 'below' && parentId) {
      updatedStem = addBlockAsSibling(parentId, newBlock, value.stem)
      // New containers start expanded
      if (blockType === 'container') {
        setCollapsedBlockIds((prev) => {
          const next = new Set(prev)
          next.delete(newBlock.id)
          return next
        })
      }
    } else {
      // Add at root level
      updatedStem = [...value.stem, newBlock]
      // New containers start expanded
      if (blockType === 'container') {
        setCollapsedBlockIds((prev) => {
          const next = new Set(prev)
          next.delete(newBlock.id)
          return next
        })
      }
    }

    updateLocalValue({
      ...value,
      stem: updatedStem,
    })
    setSelectedBlockId(newBlock.id)
  }

  const handleDeleteBlock = (blockId: string) => {
    if (!value || !value.stem) return

    const updatedStem = removeBlock(blockId, value.stem)
    updateLocalValue({
      ...value,
      stem: updatedStem,
    })

    // Clear selection if deleted block was selected
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
    }
  }

  const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
    if (!value || !value.stem) return

    // Prevent update loops - if JSON editor just updated, don't trigger from rich text
    if (lastUpdatedBy === 'jsonEditor') {
      return
    }

    // Set flag to indicate rich text is updating
    setLastUpdatedBy('richText')

    const updatedStem = updateBlock(blockId, updates, value.stem)
    updateLocalValue({
      ...value,
      stem: updatedStem,
    })

    // Clear flag after a short delay
    setTimeout(() => {
      setLastUpdatedBy(null)
    }, 100)
  }

  const handleJsonApply = (updatedBlock: Block) => {
    if (!selectedBlockId || !value || !value.stem) return

    // Prevent update loops - if rich text just updated, don't trigger from JSON
    if (lastUpdatedBy === 'richText') {
      return
    }

    // Set flag to indicate JSON editor is updating
    setLastUpdatedBy('jsonEditor')

    const updatedStem = updateBlock(selectedBlockId, updatedBlock, value.stem)
    updateLocalValue({
      ...value,
      stem: updatedStem,
    })

    // Clear flag after a short delay
    setTimeout(() => {
      setLastUpdatedBy(null)
    }, 100)
  }

  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    if (!value || !value.stem) return

    const updatedStem = moveBlockInParent(blockId, direction, value.stem)
    updateLocalValue({
      ...value,
      stem: updatedStem,
    })
  }

  // Save changes to the field (only called when save button is clicked)
  const handleSave = async () => {
    // Cancel any pending setModified(false) calls
    if (modifyTimeoutRef.current) {
      clearTimeout(modifyTimeoutRef.current)
      modifyTimeoutRef.current = null
    }

    isSavingRef.current = true
    setIsSaving(true)

    try {
      // First, update the field value in the form
      setValue(localValue)

      // Wait a moment for the value to be set in the form state
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Then mark form as modified so Payload knows to save
      // This order ensures the value is set before we mark as modified
      if (form.setModified) {
        form.setModified(true)
      }

      // Try to programmatically trigger the main form save button
      // This works even if autosave is not enabled
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Look for the main form save button and click it
      // Payload CMS typically uses a button with type="submit" in the form
      const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
      if (saveButton && !saveButton.disabled) {
        saveButton.click()
        // Wait for the save to complete
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      // Update our tracking
      setHasUnsavedChanges(false)
      lastSyncedValueRef.current = localValue
    } finally {
      setIsSaving(false)
      // After save completes, reset the flag
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

  const selectedBlock = selectedBlockId ? findBlockById(value?.stem || [], selectedBlockId) : null

  if (!value || !value.stem) {
    return <div className="p-4 text-muted-foreground">Loading editor...</div>
  }

  return (
    <div className="exercise-content-editor">
      <div className="editor-header">
        <div>
          <h3>Exercise Content</h3>
          <p className="editor-description">
            Add and arrange content blocks hierarchically. Supports containers and rich text with
            Markdown and LaTeX math.
          </p>
        </div>
        <div className="editor-header-actions">
          {hasUnsavedChanges && (
            <button
              className="editor-save-button"
              onClick={handleSave}
              title="Save changes to form (you may still need to click the main form Save button)"
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
          <div className="editor-badge">Blocks V2</div>
        </div>
      </div>

      {selectedBlockId && (
        <div className="editor-breadcrumb">
          <Breadcrumb
            blocks={value.stem}
            selectedBlockId={selectedBlockId}
            onNavigate={handleSelectBlock}
          />
        </div>
      )}

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
              <BlockTree
                blocks={value.stem}
                selectedBlockId={selectedBlockId}
                collapsedBlockIds={collapsedBlockIds}
                onSelect={handleSelectBlock}
                onToggleCollapse={handleToggleCollapse}
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
            <BlockTree
              blocks={value.stem}
              selectedBlockId={selectedBlockId}
              collapsedBlockIds={collapsedBlockIds}
              onSelect={handleSelectBlock}
              onToggleCollapse={handleToggleCollapse}
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
