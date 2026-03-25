'use client'

import type {
  ContentSlot,
  ContentSlotItem,
  ContentSlotItemData,
  InlineRichText,
} from '@/server/payload/collections/Exercises/types'
import {
  generateId,
  inlineRichTextToSlot,
  isInlineRichText,
} from '@/server/payload/collections/Exercises/types'
import { Plus, Sparkles } from 'lucide-react'
import React from 'react'
import { InlineRichTextEditor } from '../editors/InlineRichTextEditor'

// Item editors for each content type
import { AddSlotItemMenu } from './AddSlotItemMenu'
import { ContentSlotItemEditor } from './ContentSlotItemEditor'

interface ContentSlotEditorProps {
  value: ContentSlot | InlineRichText
  onChange: (value: ContentSlot) => void
  placeholder?: string
  minHeight?: string
  label?: string
}

/**
 * ContentSlotEditor - Editor for ContentSlot (v2) content
 *
 * Handles both:
 * - ContentSlot (v2): Multiple content items in a slot
 * - InlineRichText (v1): Legacy format - shows upgrade option
 */
export const ContentSlotEditor: React.FC<ContentSlotEditorProps> = ({
  value,
  onChange,
  placeholder = 'Add content...',
  minHeight = '80px',
  label,
}) => {
  const [showAddMenu, setShowAddMenu] = React.useState(false)
  const [showUpgradeConfirm, setShowUpgradeConfirm] = React.useState(false)

  // Handle InlineRichText (v1) - show upgrade option
  if (isInlineRichText(value)) {
    return (
      <div className="content-slot-editor content-slot-editor--legacy">
        <div className="content-slot-legacy">
          <InlineRichTextEditor
            value={value}
            onChange={(newValue) => {
              // Convert to ContentSlot when edited
              onChange(inlineRichTextToSlot(newValue))
            }}
            placeholder={placeholder}
            minHeight={minHeight}
          />
          <div className="content-slot-upgrade">
            <button
              type="button"
              className="content-slot-upgrade-btn"
              onClick={() => setShowUpgradeConfirm(true)}
            >
              <Sparkles size={14} />
              <span>Upgrade to Rich Content</span>
            </button>
            {showUpgradeConfirm && (
              <div className="content-slot-upgrade-confirm">
                <p>Add graphs, images, and more to this content?</p>
                <div className="content-slot-upgrade-actions">
                  <button
                    type="button"
                    className="content-slot-upgrade-confirm-btn content-slot-upgrade-confirm-btn--cancel"
                    onClick={() => setShowUpgradeConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="content-slot-upgrade-confirm-btn content-slot-upgrade-confirm-btn--confirm"
                    onClick={() => {
                      onChange(inlineRichTextToSlot(value))
                      setShowUpgradeConfirm(false)
                    }}
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Handle ContentSlot (v2)
  const slot = value as ContentSlot
  const items = slot.items || []

  const handleAddItem = (itemType: ContentSlotItemData['type']) => {
    const newItem = createContentSlotItem(itemType)
    onChange({
      version: 2,
      items: [...items, newItem],
    })
    setShowAddMenu(false)
  }

  const handleUpdateItem = (itemId: string, updates: Partial<ContentSlotItem>) => {
    onChange({
      version: 2,
      items: items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    })
  }

  const handleDeleteItem = (itemId: string) => {
    onChange({
      version: 2,
      items: items.filter((item) => item.id !== itemId),
    })
  }

  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    const index = items.findIndex((item) => item.id === itemId)
    if (index === -1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return

    const newItems = [...items]
    const [movedItem] = newItems.splice(index, 1)
    newItems.splice(targetIndex, 0, movedItem)

    onChange({
      version: 2,
      items: newItems,
    })
  }

  return (
    <div className="content-slot-editor">
      {label && <div className="content-slot-label">{label}</div>}

      <div className="content-slot-items">
        {items.map((item, index) => (
          <ContentSlotItemEditor
            key={item.id}
            item={item}
            index={index}
            totalItems={items.length}
            onUpdate={(updates) => handleUpdateItem(item.id, updates)}
            onDelete={() => handleDeleteItem(item.id)}
            onMoveUp={() => handleMoveItem(item.id, 'up')}
            onMoveDown={() => handleMoveItem(item.id, 'down')}
          />
        ))}

        {items.length === 0 && (
          <div className="content-slot-empty">
            <p>No content yet. Add text, graphs, images, or more.</p>
          </div>
        )}
      </div>

      <div className="content-slot-add">
        <button
          type="button"
          className="content-slot-add-btn"
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          <Plus size={14} />
          <span>Add Content</span>
        </button>

        {showAddMenu && (
          <AddSlotItemMenu
            onSelect={(type) => {
              handleAddItem(type)
              setShowAddMenu(false)
            }}
            onClose={() => setShowAddMenu(false)}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Create a new ContentSlotItem with default data based on type
 */
function createContentSlotItem(type: ContentSlotItemData['type']): ContentSlotItem {
  const id = generateId()

  switch (type) {
    case 'rich_text':
      return {
        id,
        data: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: '',
          mediaIds: [],
        },
      }
    case 'latex':
      return {
        id,
        data: {
          type: 'latex',
          latex: '',
          renderMode: 'inline',
        },
      }
    case 'svg':
      return {
        id,
        data: {
          type: 'svg',
          value: '',
          altText: '',
        },
      }
    case 'media':
      return {
        id,
        data: {
          type: 'media',
          mediaId: '',
        },
      }
    case 'axis_display':
      return {
        id,
        data: {
          type: 'axis_display',
          axis: createDefaultAxisSpec(),
          displaySize: 'medium',
        },
      }
    case 'geometry_display':
      return {
        id,
        data: {
          type: 'geometry_display',
          geometry: createDefaultGeometrySpec(),
        },
      }
    case 'html':
      return {
        id,
        data: {
          type: 'html',
          html: '',
        },
      }
    default:
      return {
        id,
        data: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: '',
          mediaIds: [],
        },
      }
  }
}

/**
 * Create default AxisSpecV1 for axis_display items
 */
function createDefaultAxisSpec(): import('@/infra/contracts/graphics/axis.v1').AxisSpecV1 {
  return {
    kind: 'cartesian',
    units: 1,
    grid: {
      enabled: true,
    },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels: {
        x: 'x',
        y: 'y',
      },
      origin: {
        x: 0,
        y: 0,
      },
    },
    viewportMode: 'auto',
    viewport: {
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
    },
    elements: {
      graphs: [],
      points: [],
    },
  }
}

/**
 * Create default GeometrySpecV1 for geometry_display items
 */
function createDefaultGeometrySpec(): import('@/infra/contracts/graphics/geometry.v1').GeometrySpecV1 {
  return {
    kind: 'euclidean',
    canvas: {
      width: 400,
      height: 400,
      grid: false,
    },
    elements: {
      points: [],
      lines: [],
      circles: [],
      triangles: [],
      rectangles: [],
      angles: [],
      texts: [],
      vectors: [],
    },
  }
}
