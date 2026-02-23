/**
 * @fileType component
 * @domain cody
 * @pattern board-switcher
 * @ai-summary Board tab switcher component using design system
 */
'use client'

import { cn } from '../utils'
import type { Board } from '../types'

interface BoardSwitcherProps {
  boards: Board[]
  currentBoard: string
  onBoardChange: (boardId: string) => void
}

export function BoardSwitcher({ boards, currentBoard, onBoardChange }: BoardSwitcherProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {boards.map((board) => (
        <button
          key={board.id}
          onClick={() => onBoardChange(board.id)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            currentBoard === board.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {board.name}
        </button>
      ))}
    </div>
  )
}
