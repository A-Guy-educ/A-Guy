'use client'

import { cn } from '@/infra/utils/ui'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import type { ClientBlock } from '../types'
import { BlockCard } from './BlockCard'

interface McqBlockProps {
  block: ClientBlock & { type: 'mcq' }
  selectedAnswer: string | null
  onSelect: (optionId: string) => void
  disabled: boolean
}

export function McqBlock({ block, selectedAnswer, onSelect, disabled }: McqBlockProps) {
  return (
    <BlockCard label="A-Guy" role="assistant">
      <div className="mb-4">
        <MathMarkdown
          content={block.content.value}
          className="text-base font-medium text-foreground leading-relaxed"
        />
      </div>

      <div className="space-y-3">
        {block.options?.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
              'hover:border-primary/50',
              selectedAnswer === option.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input
              type="radio"
              name={`mcq-${block.id}`}
              value={option.id}
              checked={selectedAnswer === option.id}
              onChange={() => onSelect(option.id)}
              disabled={disabled}
              className="w-5 h-5 text-primary border-2 border-muted-foreground focus:ring-2 focus:ring-primary"
            />
            <span className="flex-1">
              <MathMarkdown content={option.content.value} className="text-foreground" />
            </span>
          </label>
        ))}
      </div>
    </BlockCard>
  )
}
