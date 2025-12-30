'use client'

/**
 * Collapsible Block Card - Wrapper for content block editors with summary
 */

import React, { useState } from 'react'
import type { ExerciseBlock } from '@/contracts'
import type { EditorError } from '../shared/types'

interface CollapsibleBlockCardProps {
  block: ExerciseBlock
  index: number
  children: React.ReactNode
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  errors: EditorError[]
}

export function CollapsibleBlockCard({
  block,
  index,
  children,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  errors,
}: CollapsibleBlockCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Generate block type label
  const getBlockTypeLabel = (): string => {
    switch (block.type) {
      case 'rich_text':
        return 'Rich Text'
      case 'table':
        return 'Table'
      case 'svg':
        return 'SVG'
      case 'axis_system':
        return 'Axis System'
      case 'geometry':
        return 'Geometry'
      default:
        return 'Unknown'
    }
  }

  // Generate 1-line summary
  const getSummary = (): string => {
    switch (block.type) {
      case 'rich_text':
        return block.value.substring(0, 40) + (block.value.length > 40 ? '...' : '')
      case 'table':
        return `${block.rows.length} rows × ${block.headers.length} cols`
      case 'svg':
        return block.svg ? 'SVG present' : 'empty'
      case 'axis_system':
        const pointCount = block.spec?.elements?.points?.length || 0
        const graphCount = block.spec?.elements?.graphs?.length || 0
        return `${graphCount} graph(s), ${pointCount} point(s)`
      case 'geometry':
        const points = block.spec?.elements?.points?.length || 0
        const lines = block.spec?.elements?.lines?.length || 0
        const circles = block.spec?.elements?.circles?.length || 0
        const angles = block.spec?.elements?.angles?.length || 0
        return `${points} point(s), ${lines} line(s), ${circles} circle(s), ${angles} angle(s)`
      default:
        return 'No summary available'
    }
  }

  const hasErrors = errors.length > 0

  return (
    <div
      style={{
        marginTop: '1rem',
        border: hasErrors
          ? '2px solid var(--theme-error-500)'
          : '1px solid var(--theme-elevation-150)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {/* Block Header (always visible) */}
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--theme-elevation-50)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <span
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
              fontSize: '0.875rem',
            }}
          >
            ▶
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong>
                #{index + 1}: {getBlockTypeLabel()}
              </strong>
              {hasErrors && (
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'var(--theme-error-500)',
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: '600',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '9999px',
                  }}
                >
                  {errors.length} error{errors.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.25rem' }}>
              {getSummary()}
            </div>
          </div>
        </div>

        {/* Action buttons - stop propagation to prevent collapse */}
        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="btn btn--style-secondary btn--size-small"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="btn btn--style-secondary btn--size-small"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn--style-secondary btn--size-small"
            title="Delete block"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Block Body (visible when expanded) */}
      {isExpanded && <div style={{ padding: '1rem' }}>{children}</div>}
    </div>
  )
}
