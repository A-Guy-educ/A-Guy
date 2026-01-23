'use client'

import React from 'react'
import { useTranslations } from '@/ui/providers/I18n'
import formulas from './formulas.json'

interface FormulaPanelProps {
  isOpen: boolean
  onClose: () => void
  onInject: (template: string, cursorOffset: number) => void
}

export function FormulaPanel({ isOpen, onClose, onInject }: FormulaPanelProps) {
  const t = useTranslations('courses')

  if (!isOpen) return null

  return (
    <div className="absolute bottom-full left-2.5 right-2.5 mb-2.5 bg-card rounded-2xl border border-input shadow-panel max-h-[280px] overflow-y-auto p-4 z-30 animate-slide-up">
      {/* Algebra Section */}
      <div className="mb-4">
        <h4 className="text-primary text-sm font-semibold mb-2 pb-1 border-b border-border">
          {t('algebraFormulas')}
        </h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {formulas.algebra.map((formula, idx) => (
            <button
              key={idx}
              type="button"
              className="bg-muted border border-input rounded-lg p-2.5 text-center text-xs hover:bg-primary-soft hover:border-primary transition-colors"
              onClick={() => {
                onInject(formula.template, formula.offset)
                onClose()
              }}
            >
              {formula.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trigonometry Section */}
      <div>
        <h4 className="text-primary text-sm font-semibold mb-2 pb-1 border-b border-border">
          {t('trigonometryFormulas')}
        </h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {formulas.trigonometry.map((formula, idx) => (
            <button
              key={idx}
              type="button"
              className="bg-muted border border-input rounded-lg p-2.5 text-center text-xs hover:bg-primary-soft hover:border-primary transition-colors"
              onClick={() => {
                onInject(formula.template, formula.offset)
                onClose()
              }}
            >
              {formula.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
