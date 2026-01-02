'use client'

import React from 'react'
import { Plus, ArrowUp, ArrowDown, Trash2, ChevronDown } from 'lucide-react'
import type { Block } from '@/contracts/exercise/content'

interface ContextualToolbarProps {
  block: Block
  canMoveUp: boolean
  canMoveDown: boolean
  maxDepthReached: boolean
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
  onAdd: (blockType: 'container' | 'rich_text', position: 'inside' | 'below') => void
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  block,
  canMoveUp,
  canMoveDown,
  maxDepthReached,
  onMove,
  onDelete,
  onAdd,
}) => {
  const [showAddMenu, setShowAddMenu] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!showAddMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAddMenu])

  return (
    <div className="contextual-toolbar">
      <div className="contextual-toolbar__group">
        <div className="contextual-toolbar__add-wrapper" ref={menuRef}>
          <button
            className="contextual-toolbar__button contextual-toolbar__button--add"
            onClick={(e) => {
              e.stopPropagation()
              setShowAddMenu(!showAddMenu)
            }}
            title="Add Block"
          >
            <Plus size={14} />
            <span>Add</span>
            <ChevronDown size={12} className={showAddMenu ? 'rotated' : ''} />
          </button>
          {showAddMenu && (
            <div className="contextual-toolbar__add-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className="contextual-toolbar__menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd('rich_text', 'inside')
                  setShowAddMenu(false)
                }}
              >
                <span>Add Text (inside)</span>
              </button>
              {!maxDepthReached && (
                <button
                  className="contextual-toolbar__menu-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdd('container', 'inside')
                    setShowAddMenu(false)
                  }}
                >
                  <span>Add Container (inside)</span>
                </button>
              )}
              <div className="contextual-toolbar__menu-divider" />
              <button
                className="contextual-toolbar__menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd('rich_text', 'below')
                  setShowAddMenu(false)
                }}
              >
                <span>Add Text (below)</span>
              </button>
              {!maxDepthReached && (
                <button
                  className="contextual-toolbar__menu-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdd('container', 'below')
                    setShowAddMenu(false)
                  }}
                >
                  <span>Add Container (below)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="contextual-toolbar__group">
        <button
          className="contextual-toolbar__button"
          onClick={(e) => {
            e.stopPropagation()
            onMove('up')
          }}
          disabled={!canMoveUp}
          title="Move Up"
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="contextual-toolbar__button"
          onClick={(e) => {
            e.stopPropagation()
            onMove('down')
          }}
          disabled={!canMoveDown}
          title="Move Down"
        >
          <ArrowDown size={14} />
        </button>
      </div>
      <button
        className="contextual-toolbar__button contextual-toolbar__button--delete"
        onClick={(e) => {
          e.stopPropagation()
          if (
            confirm(
              `Delete this ${block.type === 'container' ? 'container and all its children' : 'block'}?`,
            )
          ) {
            onDelete()
          }
        }}
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
