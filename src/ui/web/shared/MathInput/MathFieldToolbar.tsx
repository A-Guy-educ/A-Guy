/**
 * MathFieldToolbar — Quick-insert buttons for common math structures.
 * Works with MathLive's MathfieldElement.insert() API.
 */

'use client'

import React, { useCallback } from 'react'
import { cn } from '@/infra/utils/ui'
import type { MathfieldElement } from 'mathlive'

interface ToolbarButton {
  label: string
  latex: string
  ariaLabel: string
}

const BUTTONS: ToolbarButton[] = [
  { label: 'a/b', latex: '\\frac{#0}{#1}', ariaLabel: 'Fraction' },
  { label: 'xⁿ', latex: '^{#0}', ariaLabel: 'Exponent' },
  { label: '√', latex: '\\sqrt{#0}', ariaLabel: 'Square root' },
  { label: 'x₂', latex: '_{#0}', ariaLabel: 'Subscript' },
  { label: '( )', latex: '\\left(#0\\right)', ariaLabel: 'Parentheses' },
  { label: 'π', latex: '\\pi', ariaLabel: 'Pi' },
  { label: '≤', latex: '\\leq', ariaLabel: 'Less than or equal' },
  { label: '≥', latex: '\\geq', ariaLabel: 'Greater than or equal' },
  { label: '≠', latex: '\\neq', ariaLabel: 'Not equal' },
  { label: '±', latex: '\\pm', ariaLabel: 'Plus minus' },
]

export interface MathFieldToolbarProps {
  mathfield: MathfieldElement | null
  className?: string
}

export function MathFieldToolbar({ mathfield, className }: MathFieldToolbarProps) {
  const handleInsert = useCallback(
    (latex: string) => {
      if (!mathfield) return
      mathfield.insert(latex, { mode: 'math', selectionMode: 'placeholder', focus: true })
    },
    [mathfield],
  )

  return (
    <div
      className={cn('flex gap-1 overflow-x-auto scrollbar-none py-1', className)}
      role="toolbar"
      aria-label="Math symbols"
    >
      {BUTTONS.map((btn) => (
        <button
          key={btn.ariaLabel}
          type="button"
          className={cn(
            'shrink-0 min-w-[44px] h-10 px-2.5 rounded-md',
            'border border-border bg-background text-foreground',
            'hover:bg-accent hover:text-accent-foreground',
            'transition-colors text-base',
          )}
          onClick={() => handleInsert(btn.latex)}
          aria-label={btn.ariaLabel}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
