'use client'

import React from 'react'
import { Folder, ChevronDown, ChevronRight } from 'lucide-react'
import type { ContainerBlock as ContainerBlockType } from '@/contracts/exercise/content'
import { ContextualToolbar } from './ContextualToolbar'

interface ContainerBlockProps {
  block: ContainerBlockType
  level: number // 0, 1, or 2 (max depth)
  path: string[] // Array of block IDs from root
  isSelected: boolean
  isCollapsed: boolean
  onSelect: (blockId: string) => void
  onToggleCollapse: (blockId: string) => void
  onAddBlock: (
    parentId: string | null,
    blockType: 'container' | 'rich_text',
    position: 'inside' | 'below',
  ) => void
  onDelete: (blockId: string) => void
  onUpdate: (blockId: string, updates: Partial<ContainerBlockType>) => void
  onMove: (blockId: string, direction: 'up' | 'down') => void
  canMoveUp: boolean
  canMoveDown: boolean
  children: React.ReactNode // Rendered child blocks
}

export const ContainerBlock: React.FC<ContainerBlockProps> = ({
  block,
  level,
  path,
  isSelected,
  isCollapsed,
  onSelect,
  onToggleCollapse,
  onAddBlock,
  onDelete,
  onUpdate,
  onMove,
  canMoveUp,
  canMoveDown,
  children,
}: ContainerBlockProps) => {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [titleValue, setTitleValue] = React.useState(block.title || '')

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    onUpdate(block.id, { title: titleValue || undefined })
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
    }
    if (e.key === 'Escape') {
      setTitleValue(block.title || '')
      setIsEditingTitle(false)
    }
  }

  const maxDepthReached = level >= 2

  return (
    <div
      className={`container-block container-block--level-${level} ${isSelected ? 'block--selected' : ''}`}
      onClick={(e) => {
        // Don't select if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button, input')) return
        onSelect(block.id)
      }}
    >
      <div className="container-block__header">
        <div className="container-block__header-left">
          <button
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(block.id)
            }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <Folder size={14} className="container-block__icon" />
          {isEditingTitle ? (
            <input
              type="text"
              className="container-block__title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              placeholder="Container title..."
              autoFocus
            />
          ) : (
            <span
              className="container-block__title"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditingTitle(true)
              }}
            >
              {block.title || 'Untitled Container'}
            </span>
          )}
        </div>

        {isSelected && (
          <ContextualToolbar
            block={block}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            maxDepthReached={maxDepthReached}
            onMove={(direction) => onMove(block.id, direction)}
            onDelete={() => onDelete(block.id)}
            onAdd={(blockType, position) => {
              if (position === 'inside') {
                onAddBlock(block.id, blockType, 'inside')
              } else {
                onAddBlock(block.id, blockType, 'below')
              }
            }}
          />
        )}
      </div>

      {!isCollapsed && (
        <div className="container-block__body">
          <div className="container-block__children">{children}</div>
        </div>
      )}
    </div>
  )
}
