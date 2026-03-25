/**
 * FormulaSheetButton
 *
 * @fileType component
 * @domain formula-sheets
 * @pattern action-button
 * @ai-summary Toggle button for formula sheet - just a styled button, no modal/sheet
 */

'use client'

import { BookOpen, X } from 'lucide-react'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

export interface FormulaSheetButtonProps {
  /** Whether the formula sheet is currently shown */
  isOpen: boolean

  /** Toggle callback */
  onToggle: () => void

  /** Additional className for the button */
  className?: string
}

/**
 * FormulaSheetButton - Toggles formula sheet visibility inline
 *
 * This is just a button — the actual content rendering and open/close
 * state is managed by the parent (ChatInterface).
 */
export function FormulaSheetButton({ isOpen, onToggle, className }: FormulaSheetButtonProps) {
  const t = useTranslations('courses')

  return (
    <Button
      variant={isOpen ? 'default' : 'outline'}
      size="sm"
      className={className}
      onClick={onToggle}
      aria-label={t('formulaSheetTitle')}
    >
      {isOpen ? (
        <X className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
      ) : (
        <BookOpen className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
      )}
      <span>{t('formulaSheetTitle')}</span>
    </Button>
  )
}
