'use client'

import React from 'react'
import { useTranslations } from '@/providers/I18n'

interface FormulaPanelProps {
  isOpen: boolean
  onClose: () => void
  onInject: (template: string, cursorOffset: number) => void
}

const formulas = {
  algebra: [
    { label: '(a+b)²', template: '(a+b)^2 = a^2+2ab+b^2', offset: 0 },
    { label: 'נוסחת השורשים', template: 'x_{1,2} = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', offset: 0 },
    { label: '(a-b)²', template: '(a-b)^2 = a^2-2ab+b^2', offset: 0 },
    { label: 'a²-b²', template: 'a^2-b^2 = (a+b)(a-b)', offset: 0 },
  ],
  trigonometry: [
    { label: 'זהות יסוד', template: '\\sin^2\\alpha + \\cos^2\\alpha = 1', offset: 0 },
    { label: 'משפט פיתגורס', template: 'a^2 + b^2 = c^2', offset: 0 },
    { label: 'חוק הסינוסים', template: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B}', offset: 0 },
    { label: 'חוק הקוסינוסים', template: 'c^2 = a^2 + b^2 - 2ab\\cos C', offset: 0 },
  ],
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
