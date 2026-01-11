'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
import mathKeys from './math-keys.json'

interface MathPaletteProps {
  isOpen: boolean
  onInject: (template: string, cursorOffset: number) => void
}

export function MathPalette({ isOpen, onInject }: MathPaletteProps) {
  if (!isOpen) return null

  return (
    <div className="flex gap-2 py-2.5 overflow-x-auto scrollbar-none border-b border-border mb-2.5">
      {mathKeys.map((key, idx) => (
        <button
          key={idx}
          type="button"
          className={cn(
            'flex-shrink-0 h-10 min-w-[44px] px-2.5',
            'bg-muted rounded-[100px] border border-input',
            'text-primary font-bold text-sm',
            'hover:bg-primary-soft hover:border-primary',
            'transition-colors',
          )}
          onClick={() => onInject(key.template, key.offset)}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}
