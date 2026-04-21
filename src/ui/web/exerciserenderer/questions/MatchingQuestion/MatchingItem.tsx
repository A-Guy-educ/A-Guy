'use client'

import React from 'react'
import { motion } from 'framer-motion'
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

function hasResult(state: boolean | null): boolean {
  return state !== null
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
    <motion.button
      ref={(el) => onRef(item.id, el)}
      onClick={() => onClick(item.id)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      whileHover={!disabled && !isSelected && !isConnected ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      className={cn(
        'relative flex items-center gap-content-gap-xs p-3.5 rounded-xl border-2 text-start overflow-hidden',
        'transition-all duration-normal min-h-[44px]',
        'bg-background/50 dark:bg-card dark:shadow-card',
        !disabled &&
          !isSelected &&
          !isConnected &&
          'border-border/40 dark:border-border/50 hover:border-[hsl(var(--tab-exams)/0.5)] dark:hover:shadow-card-hover cursor-pointer',
        canSelect && !isConnected && 'cursor-pointer',
        isSelected && 'border-[hsl(var(--tab-exams))] bg-[hsl(var(--tab-exams)/0.08)]',
        isConnected &&
          !isSelected &&
          !hasResult(correctState) &&
          'border-[hsl(var(--tab-exams)/0.4)] bg-[hsl(var(--tab-exams)/0.04)]',
        disabled && 'cursor-not-allowed opacity-50',
        correctState === true && 'border-success bg-success/10',
        correctState === false && 'border-destructive bg-destructive/10',
      )}
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
    >
      {/* Colored left accent */}
      <div
        className="absolute start-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{
          backgroundColor: isSelected
            ? 'hsl(var(--tab-exams))'
            : hasResult(correctState)
              ? correctState
                ? 'hsl(var(--success))'
                : 'hsl(var(--destructive))'
              : isConnected
                ? 'hsl(var(--tab-exams)/0.5)'
                : 'transparent',
          opacity: isSelected || hasResult(correctState) || isConnected ? 1 : 0,
        }}
      />
      <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center font-bold text-body-xs text-muted-foreground min-w-[24px] shrink-0 border border-border/30">
        {badge}
      </span>
      <span className="flex-1 ps-1">
        <RichTextRenderer block={optionBlock} />
      </span>
      {correctState === true && <Check className="w-5 h-5 text-success shrink-0" />}
      {correctState === false && <X className="w-5 h-5 text-destructive shrink-0" />}
    </motion.button>
  )
}
