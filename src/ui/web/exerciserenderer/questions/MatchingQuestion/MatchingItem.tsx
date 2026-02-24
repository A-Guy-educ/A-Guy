'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { Check, X } from 'lucide-react'
import type { RichTextBlock, MatchingOption } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import { getLetter } from './matchingUtils'

interface MatchingItemProps {
  item: MatchingOption
  index: number
  side: 'left' | 'right'
  questionId: string
  isSelected: boolean
  isConnected: boolean
  correctState: boolean | null
  canSelect: boolean
  disabled: boolean
  onClick: (id: string) => void
  onRef: (id: string, el: HTMLButtonElement | null) => void
}

export function MatchingItem({
  item,
  index,
  side,
  questionId,
  isSelected,
  isConnected,
  correctState,
  canSelect,
  disabled,
  onClick,
  onRef,
}: MatchingItemProps) {
  const badge = side === 'left' ? `${index + 1}.` : `${getLetter(index)}.`

  const optionBlock: RichTextBlock = {
    ...item.content,
    id: `${questionId}-${side}-${item.id}`,
    mediaIds: item.content.mediaIds || [],
  }

  return (
    <button
      ref={(el) => onRef(item.id, el)}
      onClick={() => onClick(item.id)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border-2 text-start',
        'transition-all duration-200 min-h-[44px]',
        'border-border bg-card',
        !disabled &&
          !isSelected &&
          !isConnected &&
          'hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        canSelect && !isConnected && 'cursor-pointer',
        isSelected &&
          'border-blue-500 bg-blue-50 dark:bg-blue-500/15 border-[3px] shadow-[0_0_10px_rgba(59,130,246,0.3)]',
        isConnected &&
          !isSelected &&
          !hasResult(correctState) &&
          'border-blue-400 bg-blue-50 dark:bg-blue-500/10',
        disabled && 'cursor-not-allowed opacity-70',
        correctState === true && 'border-green-500 bg-green-50 dark:bg-green-500/10',
        correctState === false && 'border-destructive bg-red-50 dark:bg-destructive/10',
      )}
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
    >
      <span className="font-bold text-lg text-muted-foreground min-w-[28px] shrink-0">{badge}</span>
      <span className="flex-1">
        <RichTextRenderer block={optionBlock} />
      </span>
      {correctState === true && <Check className="w-5 h-5 text-green-600 shrink-0" />}
      {correctState === false && <X className="w-5 h-5 text-destructive shrink-0" />}
    </button>
  )
}

function hasResult(state: boolean | null): boolean {
  return state !== null
}
