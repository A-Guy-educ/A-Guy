'use client'

import type { ContentSlotItem } from '@/server/payload/collections/Exercises/types'
import {
  Code,
  FileText,
  Image as ImageIcon,
  LineChart,
  MoveDown,
  MoveUp,
  Sigma,
  Trash2,
  Triangle,
} from 'lucide-react'
import React from 'react'
import { InlineRichTextEditor } from '../editors/InlineRichTextEditor'

// Display-only editors for axis and geometry
import { AxisDisplayEditor } from './AxisDisplayEditor'
import { GeometryDisplayEditor } from './GeometryDisplayEditor'

interface ContentSlotItemEditorProps {
  item: ContentSlotItem
  index: number
  totalItems: number
  onUpdate: (updates: Partial<ContentSlotItem>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

/**
 * ContentSlotItemEditor - Editor for a single content slot item
 */
export const ContentSlotItemEditor: React.FC<ContentSlotItemEditorProps> = ({
  item,
  index,
  totalItems,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const { data } = item

  const getItemIcon = () => {
    switch (data.type) {
      case 'rich_text':
        return <FileText size={14} />
      case 'latex':
        return <Sigma size={14} />
      case 'svg':
        return <ImageIcon size={14} />
      case 'media':
        return <ImageIcon size={14} />
      case 'axis_display':
        return <LineChart size={14} />
      case 'geometry_display':
        return <Triangle size={14} />
      case 'html':
        return <Code size={14} />
      default:
        return <FileText size={14} />
    }
  }

  const getItemLabel = () => {
    switch (data.type) {
      case 'rich_text':
        return 'Text'
      case 'latex':
        return 'LaTeX'
      case 'svg':
        return 'SVG'
      case 'media':
        return 'Media'
      case 'axis_display':
        return 'Graph'
      case 'geometry_display':
        return 'Geometry'
      case 'html':
        return 'HTML'
      default:
        return 'Content'
    }
  }

  const renderItemEditor = () => {
    switch (data.type) {
      case 'rich_text':
        return (
          <InlineRichTextEditor
            value={{
              type: 'rich_text',
              format: data.format || 'md-math-v1',
              value: data.value || '',
              mediaIds: data.mediaIds || [],
            }}
            onChange={(newValue) => {
              onUpdate({
                data: {
                  ...data,
                  type: 'rich_text',
                  format: newValue.format,
                  value: newValue.value,
                  mediaIds: newValue.mediaIds,
                },
              })
            }}
            placeholder="Enter text..."
            minHeight="60px"
          />
        )

      case 'latex':
        return (
          <div className="slot-item-latex-editor">
            <div className="slot-item-latex-mode">
              <label>
                <input
                  type="radio"
                  name={`latex-mode-${item.id}`}
                  checked={data.renderMode !== 'block'}
                  onChange={() => onUpdate({ data: { ...data, renderMode: 'inline' } })}
                />
                <span>Inline</span>
              </label>
              <label>
                <input
                  type="radio"
                  name={`latex-mode-${item.id}`}
                  checked={data.renderMode === 'block'}
                  onChange={() => onUpdate({ data: { ...data, renderMode: 'block' } })}
                />
                <span>Block</span>
              </label>
            </div>
            <textarea
              className="slot-item-latex-input"
              value={data.latex || ''}
              onChange={(e) => onUpdate({ data: { ...data, latex: e.target.value } })}
              placeholder="Enter LaTeX (e.g., x^2 + y^2 = r^2)"
              rows={2}
            />
          </div>
        )

      case 'svg':
        return (
          <div className="slot-item-svg-editor">
            <textarea
              className="slot-item-svg-input"
              value={data.value || ''}
              onChange={(e) => onUpdate({ data: { ...data, value: e.target.value } })}
              placeholder="Enter SVG markup..."
              rows={4}
            />
            <input
              type="text"
              className="slot-item-svg-alt"
              value={data.altText || ''}
              onChange={(e) => onUpdate({ data: { ...data, altText: e.target.value } })}
              placeholder="Accessibility description"
            />
          </div>
        )

      case 'media':
        return (
          <div className="slot-item-media-editor">
            <input
              type="text"
              className="slot-item-media-input"
              value={data.mediaId || ''}
              onChange={(e) => onUpdate({ data: { ...data, mediaId: e.target.value } })}
              placeholder="Enter media ID..."
            />
            <p className="slot-item-media-hint">Select a media item from the media collection</p>
          </div>
        )

      case 'axis_display':
        return (
          <AxisDisplayEditor
            axis={data.axis}
            displaySize={data.displaySize}
            onChange={(updates) => {
              onUpdate({
                data: {
                  ...data,
                  axis: updates.axis,
                  displaySize: updates.displaySize,
                },
              })
            }}
          />
        )

      case 'geometry_display':
        return (
          <GeometryDisplayEditor
            geometry={data.geometry}
            onChange={(updates) => {
              onUpdate({
                data: {
                  ...data,
                  geometry: updates.geometry,
                },
              })
            }}
          />
        )

      case 'html':
        return (
          <div className="slot-item-html-editor">
            <textarea
              className="slot-item-html-input"
              value={data.html || ''}
              onChange={(e) => onUpdate({ data: { ...data, html: e.target.value } })}
              placeholder="Enter HTML..."
              rows={4}
            />
          </div>
        )

      default:
        return <div className="slot-item-unknown">Unknown item type</div>
    }
  }

  return (
    <div className="content-slot-item">
      <div className="content-slot-item-header">
        <div className="content-slot-item-info">
          <span className="content-slot-item-icon">{getItemIcon()}</span>
          <span className="content-slot-item-type">{getItemLabel()}</span>
          <span className="content-slot-item-index">#{index + 1}</span>
        </div>
        <div className="content-slot-item-actions">
          <button
            type="button"
            className="slot-item-action-btn"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
          >
            <MoveUp size={12} />
          </button>
          <button
            type="button"
            className="slot-item-action-btn"
            onClick={onMoveDown}
            disabled={index === totalItems - 1}
            title="Move down"
          >
            <MoveDown size={12} />
          </button>
          <button
            type="button"
            className="slot-item-action-btn slot-item-action-btn--delete"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="content-slot-item-body">{renderItemEditor()}</div>
    </div>
  )
}
