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
        'flex items-center gap-content-gap-xs px-3 py-2 rounded-md border-2 text-start',
        'transition-all duration-normal min-h-[44px]',
        'border-border bg-card',
        !disabled &&
          !isSelected &&
          !isConnected &&
          'hover:border-primary/60 hover:shadow-elevation-3 hover:-translate-y-0.5 cursor-pointer',
        canSelect && !isConnected && 'cursor-pointer',
        isSelected && 'border-primary bg-primary/10 border-[3px] shadow-elevation-3',
        isConnected && !isSelected && !hasResult(correctState) && 'border-primary/60 bg-primary/5',
        disabled && 'cursor-not-allowed opacity-disabled',
        correctState === true && 'border-success bg-success/10',
        correctState === false && 'border-destructive bg-destructive/10',
      )}
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
    >
      <span className="font-bold text-body-lg text-muted-foreground min-w-[28px] shrink-0">
        {badge}
      </span>
      <span className="flex-1">
        <RichTextRenderer block={optionBlock} />
      </span>
      {correctState === true && <Check className="w-5 h-5 text-success shrink-0" />}
      {correctState === false && <X className="w-5 h-5 text-destructive shrink-0" />}
    </button>
  )
}

function hasResult(state: boolean | null): boolean {
  return state !== null
}
