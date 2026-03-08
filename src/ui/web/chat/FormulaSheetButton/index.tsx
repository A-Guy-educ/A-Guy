'use client'

/**
 * Formula Sheet Button Component
 *
 * Fetches formula sheet data and renders a toggle button.
 * Hidden if no formula sheet is available for the lesson.
 */

import { FileText } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useState, useEffect } from 'react'
import { cn } from '@/infra/utils/ui'

interface FormulaSheetData {
  id: string
  name: string
  locale: string
  kind: 'richtext' | 'pdf'
  content?: unknown
  pdfFile?: {
    id: string
    url?: string | null
    filename?: string | null
  } | null
  pdfStatus?: 'ok' | 'missing'
  isEmpty?: boolean
}

interface FormulaSheetButtonProps {
  lessonId: string
  disabled?: boolean
  onOpen?: (data: FormulaSheetData) => void
}

export function FormulaSheetButton({ lessonId, disabled, onOpen }: FormulaSheetButtonProps) {
  const t = useTranslations('courses')
  const [isOpen, setIsOpen] = useState(false)
  const [sheet, setSheet] = useState<FormulaSheetData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch formula sheet data - called unconditionally
  useEffect(() => {
    // Don't fetch if no lessonId
    if (!lessonId) {
      setIsLoading(false)
      return
    }

    let mounted = true

    async function fetchSheet() {
      try {
        const res = await fetch(`/api/formula-sheet?lessonId=${lessonId}`)
        if (!res.ok) {
          if (mounted) {
            setSheet(null)
            setIsLoading(false)
          }
          return
        }
        const data = await res.json()
        if (mounted) {
          setSheet(data.formulaSheet || null)
          setIsLoading(false)
        }
      } catch {
        if (mounted) {
          setSheet(null)
          setIsLoading(false)
        }
      }
    }

    fetchSheet()

    return () => {
      mounted = false
    }
  }, [lessonId])

  // Don't render if no lessonId
  if (!lessonId) {
    return null
  }

  // Don't render if loading or no sheet
  if (isLoading || !sheet) {
    return null
  }

  // Hide button if sheet is empty or has missing PDF
  if (sheet.isEmpty || sheet.pdfStatus === 'missing') {
    return null
  }

  const handleClick = () => {
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)
    if (newIsOpen && onOpen) {
      onOpen(sheet)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      aria-label={t('formulaSheet')}
    >
      <FileText className="w-4 h-4" />
      <span>{t('formulaSheet')}</span>
    </button>
  )
}

export type { FormulaSheetData }
