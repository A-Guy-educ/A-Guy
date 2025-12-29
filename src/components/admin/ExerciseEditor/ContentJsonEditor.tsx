'use client'

/**
 * ContentJson Editor - Main orchestrator for exercise content blocks
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { ExerciseContent, ExerciseBlock } from '@/contracts'
import { ExerciseContentSchema } from '@/contracts'
import { generateBlockId, zodErrorsToEditorErrors, getErrorsForPath } from '../shared/utils'
import type { EditorError } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { AdvancedJsonPanel } from '../shared/AdvancedJsonPanel'
import { RichTextBlockEditor } from './RichTextBlockEditor'
import { TableBlockEditor } from './TableBlockEditor'
import { SvgBlockEditor } from './SvgBlockEditor'
import { AxisSystemBlockEditor } from './AxisSystemBlockEditor'
import { GeometryBlockEditor } from './GeometryBlockEditor'

interface ContentJsonEditorProps {
  value: ExerciseContent
  onChange: (value: ExerciseContent) => void
  path: string
}

export function ContentJsonEditor({ value, onChange }: ContentJsonEditorProps) {
  const [validationErrors, setValidationErrors] = useState<EditorError[]>([])
  const validationTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Validate on change (debounced)
  const validateContent = useCallback((content: ExerciseContent) => {
    const result = ExerciseContentSchema.safeParse(content)
    if (!result.success) {
      setValidationErrors(zodErrorsToEditorErrors(result.error))
    } else {
      setValidationErrors([])
    }
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
    }
  }, [])

  const handleChange = useCallback(
    (newContent: ExerciseContent) => {
      onChange(newContent)
      // Clear existing timer
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
      // Debounced validation
      validationTimerRef.current = setTimeout(() => validateContent(newContent), 500)
    },
    [onChange, validateContent],
  )

  // Block operations
  const updateBlock = (index: number, updatedBlock: ExerciseBlock) => {
    const newStem = [...value.stem]
    newStem[index] = updatedBlock
    handleChange({ ...value, stem: newStem })
  }

  const deleteBlock = (index: number) => {
    const newStem = value.stem.filter((_, i) => i !== index)
    handleChange({ ...value, stem: newStem })
  }

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newStem = [...value.stem]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newStem[index], newStem[targetIndex]] = [newStem[targetIndex], newStem[index]]
    handleChange({ ...value, stem: newStem })
  }

  const addBlock = (type: ExerciseBlock['type']) => {
    const id = generateBlockId()
    let newBlock: ExerciseBlock

    switch (type) {
      case 'rich_text':
        newBlock = {
          id,
          type: 'rich_text',
          format: 'md-math-v1',
          value: 'Write your content here...',
        }
        break
      case 'table':
        newBlock = {
          id,
          type: 'table',
          headers: ['Column 1', 'Column 2'],
          rows: [
            ['', ''],
            ['', ''],
          ],
          showBorders: true,
          showHeader: true,
          columnAlignment: ['left', 'left'],
        }
        break
      case 'svg':
        newBlock = {
          id,
          type: 'svg',
          svg: '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="50" fill="blue"/></svg>',
        }
        break
      case 'axis_system':
        newBlock = {
          id,
          type: 'axis_system',
          specVersion: 1,
          spec: {
            kind: 'cartesian',
            units: 50,
            grid: { enabled: true },
            axes: {
              showNumbers: true,
              showLabels: true,
              ticks: 1,
              labels: { x: 'x', y: 'y' },
              origin: { x: 0, y: 0 },
            },
            viewport: undefined,
            elements: {
              points: [],
              graphs: [],
            },
            interactionSpec: undefined,
          },
        }
        break
      case 'geometry':
        newBlock = {
          id,
          type: 'geometry',
          specVersion: 1,
          spec: {
            kind: 'euclidean',
            canvas: { width: 600, height: 400, grid: false },
            elements: {
              points: [],
              lines: [],
              circles: [],
              angles: [],
            },
            interactionSpec: undefined,
          },
        }
        break
      default:
        return
    }

    handleChange({ ...value, stem: [...value.stem, newBlock] })
  }

  const renderBlockEditor = (block: ExerciseBlock, index: number) => {
    const blockErrors = getErrorsForPath(validationErrors, `stem.${index}`)
    const commonProps = {
      onDelete: () => deleteBlock(index),
      onMoveUp: () => moveBlock(index, 'up'),
      onMoveDown: () => moveBlock(index, 'down'),
      canMoveUp: index > 0,
      canMoveDown: index < value.stem.length - 1,
      errors: blockErrors,
    }

    switch (block.type) {
      case 'rich_text':
        return (
          <RichTextBlockEditor
            key={block.id}
            block={block}
            onChange={(updated) => updateBlock(index, updated)}
            {...commonProps}
          />
        )
      case 'table':
        return (
          <TableBlockEditor
            key={block.id}
            block={block}
            onChange={(updated) => updateBlock(index, updated)}
            {...commonProps}
          />
        )
      case 'svg':
        return (
          <SvgBlockEditor
            key={block.id}
            block={block}
            onChange={(updated) => updateBlock(index, updated)}
            {...commonProps}
          />
        )
      case 'axis_system':
        return (
          <AxisSystemBlockEditor
            key={block.id}
            block={block}
            onChange={(updated) => updateBlock(index, updated)}
            {...commonProps}
          />
        )
      case 'geometry':
        return (
          <GeometryBlockEditor
            key={block.id}
            block={block}
            onChange={(updated) => updateBlock(index, updated)}
            {...commonProps}
          />
        )
      default:
        return null
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3 className="">Exercise Content Blocks</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => addBlock('rich_text')}
            className="btn btn--style-secondary btn--size-small"
          >
            + Rich Text
          </button>
          <button
            type="button"
            onClick={() => addBlock('table')}
            className="btn btn--style-secondary btn--size-small"
          >
            + Table
          </button>
          <button
            type="button"
            onClick={() => addBlock('svg')}
            className="btn btn--style-secondary btn--size-small"
          >
            + SVG
          </button>
          <button
            type="button"
            onClick={() => addBlock('axis_system')}
            className="btn btn--style-secondary btn--size-small"
          >
            + Axis System
          </button>
          <button
            type="button"
            onClick={() => addBlock('geometry')}
            className="btn btn--style-secondary btn--size-small"
          >
            + Geometry
          </button>
        </div>
      </div>

      <ErrorDisplay errors={getErrorsForPath(validationErrors, 'stem')} />

      {/* Block List */}
      <div>
        {value.stem.length === 0 ? (
          <div
            style={{
              border: '2px dashed var(--theme-elevation-150)',
              borderRadius: '4px',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <p style={{ opacity: 0.6 }}>
              No content blocks yet. Click a button above to add content.
            </p>
          </div>
        ) : (
          value.stem.map((block, index) => renderBlockEditor(block, index))
        )}
      </div>

      {/* Advanced JSON Panel */}
      <AdvancedJsonPanel
        value={value}
        onChange={(newValue) => handleChange(newValue as ExerciseContent)}
        label="Advanced: Content JSON"
      />
    </div>
  )
}
