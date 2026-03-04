/**
 * FormulaComposer — Inline WYSIWYG formula editor (like Word's equation space).
 * Opens a MathField where students compose math visually, then insert into text.
 */

'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/infra/utils/ui'
import { X, Check } from 'lucide-react'
import { MathField } from './MathField'
import { MathFieldToolbar } from './MathFieldToolbar'
import type { MathfieldElement } from 'mathlive'

export interface FormulaComposerProps {
  onInsert: (latex: string) => void
  onClose: () => void
  className?: string
}

export function FormulaComposer({ onInsert, onClose, className }: FormulaComposerProps) {
  const [formulaValue, setFormulaValue] = useState('')
  const [mathfield, setMathfield] = useState<MathfieldElement | null>(null)

  const handleReady = useCallback((el: MathfieldElement) => setMathfield(el), [])

  const handleInsert = useCallback(() => {
    if (!formulaValue.trim()) return
    onInsert(formulaValue)
    setFormulaValue('')
    onClose()
  }, [formulaValue, onInsert, onClose])

  return (
    <div className={cn('border border-primary/30 rounded-lg p-3 bg-muted/30', className)}>
      <MathFieldToolbar mathfield={mathfield} className="mb-2" />

      <MathField
        value={formulaValue}
        onChange={setFormulaValue}
        onReady={handleReady}
        placeholder="Type or use buttons..."
      />

      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleInsert}
          disabled={!formulaValue.trim()}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
