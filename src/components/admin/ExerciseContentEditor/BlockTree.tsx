'use client'

import React from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import type {
  Block,
  ContainerBlock as ContainerBlockType,
  RichTextBlock,
} from '@/contracts/exercise/content'
import { ContainerBlock } from './ContainerBlock'
import { BlockCard } from './BlockCard'
import { ContextualToolbar } from './ContextualToolbar'

interface BlockTreeProps {
  blocks: Block[]
  selectedBlockId: string | null
  collapsedBlockIds: Set<string>
  onSelect: (blockId: string) => void
  onToggleCollapse: (blockId: string) => void
  onAddBlock: (
    parentId: string | null,
    blockType: 'container' | 'rich_text',
    position: 'inside' | 'below',
  ) => void
  onDeleteBlock: (blockId: string) => void
  onUpdateBlock: (blockId: string, updates: Partial<Block>) => void
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void
}

interface BlockTreeNodeProps {
  block: Block
  level: number
  path: string[]
  selectedBlockId: string | null
  collapsedBlockIds: Set<string>
  onSelect: (blockId: string) => void
  onToggleCollapse: (blockId: string) => void
  onAddBlock: (
    parentId: string | null,
    blockType: 'container' | 'rich_text',
    position: 'inside' | 'below',
  ) => void
  onDeleteBlock: (blockId: string) => void
  onUpdateBlock: (blockId: string, updates: Partial<Block>) => void
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void
  siblings: Block[]
  index: number
}

const BlockTreeNode: React.FC<BlockTreeNodeProps> = ({
  block,
  level,
  path,
  selectedBlockId,
  collapsedBlockIds,
  onSelect,
  onToggleCollapse,
  onAddBlock,
  onDeleteBlock,
  onUpdateBlock,
  onMoveBlock,
  siblings,
  index,
}) => {
  const isSelected = block.id === selectedBlockId
  const isCollapsed = collapsedBlockIds.has(block.id)

  if (block.type === 'container') {
    const containerBlock = block as ContainerBlockType
    const canMoveUp = index > 0
    const canMoveDown = index < siblings.length - 1

    const handleDelete = (blockId: string) => {
      onDeleteBlock(blockId)
    }

    const handleUpdate = (blockId: string, updates: Partial<ContainerBlockType>) => {
      onUpdateBlock(blockId, updates)
    }

    const handleMove = (blockId: string, direction: 'up' | 'down') => {
      onMoveBlock(blockId, direction)
    }

    return (
      <ContainerBlock
        block={containerBlock}
        level={level}
        path={path}
        isSelected={isSelected}
        isCollapsed={isCollapsed}
        onSelect={onSelect}
        onToggleCollapse={onToggleCollapse}
        onAddBlock={onAddBlock}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onMove={handleMove}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      >
        {!isCollapsed &&
          containerBlock.children.map((child, childIndex) => (
            <BlockTreeNode
              key={child.id}
              block={child}
              level={level + 1}
              path={[...path, child.id]}
              selectedBlockId={selectedBlockId}
              collapsedBlockIds={collapsedBlockIds}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              onAddBlock={onAddBlock}
              onDeleteBlock={onDeleteBlock}
              onUpdateBlock={onUpdateBlock}
              onMoveBlock={onMoveBlock}
              siblings={containerBlock.children}
              index={childIndex}
            />
          ))}
      </ContainerBlock>
    )
  } else {
    // RichTextBlock
    const richTextBlock = block as RichTextBlock
    const canMoveUp = index > 0
    const canMoveDown = index < siblings.length - 1

    return (
      <div
        className={`block-card-wrapper block-card-wrapper--level-${level} ${isSelected ? 'block--selected' : ''}`}
        onClick={() => onSelect(block.id)}
      >
        {isSelected && (
          <ContextualToolbar
            block={block}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            maxDepthReached={false}
            onMove={(direction) => onMoveBlock(block.id, direction)}
            onDelete={() => onDeleteBlock(block.id)}
            onAdd={(blockType, position) => {
              // For rich text blocks, we need to find parent to add
              // For now, add as sibling
              onAddBlock(block.id, blockType, position)
            }}
          />
        )}
        <BlockCard
          block={richTextBlock}
          index={index}
          total={siblings.length}
          onChange={(updates) => onUpdateBlock(block.id, updates)}
          onDelete={() => {}}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
        />
      </div>
    )
  }
}

export const BlockTree: React.FC<BlockTreeProps> = ({
  blocks,
  selectedBlockId,
  collapsedBlockIds,
  onSelect,
  onToggleCollapse,
  onAddBlock,
  onDeleteBlock,
  onUpdateBlock,
  onMoveBlock,
}) => {
  const [showRootAddMenu, setShowRootAddMenu] = React.useState(false)
  const rootMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!showRootAddMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (rootMenuRef.current && !rootMenuRef.current.contains(event.target as Node)) {
        setShowRootAddMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showRootAddMenu])

  return (
    <div className="block-tree">
      {blocks.length === 0 ? (
        <div className="block-tree__empty">
          <p>No blocks yet. Add your first block below.</p>
        </div>
      ) : (
        blocks.map((block, index) => (
          <BlockTreeNode
            key={block.id}
            block={block}
            level={0}
            path={[block.id]}
            selectedBlockId={selectedBlockId}
            collapsedBlockIds={collapsedBlockIds}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onAddBlock={onAddBlock}
            onDeleteBlock={onDeleteBlock}
            onUpdateBlock={onUpdateBlock}
            onMoveBlock={onMoveBlock}
            siblings={blocks}
            index={index}
          />
        ))
      )}
      <div className="block-tree__add-root" ref={rootMenuRef}>
        <button
          className="block-tree__add-button"
          onClick={() => setShowRootAddMenu(!showRootAddMenu)}
          title="Add Block"
        >
          <Plus size={16} />
          <span>Add</span>
          <ChevronDown size={12} className={showRootAddMenu ? 'rotated' : ''} />
        </button>
        {showRootAddMenu && (
          <div className="contextual-toolbar__add-menu" onClick={(e) => e.stopPropagation()}>
            <button
              className="contextual-toolbar__menu-item"
              onClick={() => {
                onAddBlock(null, 'rich_text', 'below')
                setShowRootAddMenu(false)
              }}
            >
              <span>Add Text</span>
            </button>
            <button
              className="contextual-toolbar__menu-item"
              onClick={() => {
                onAddBlock(null, 'container', 'below')
                setShowRootAddMenu(false)
              }}
            >
              <span>Add Container</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
