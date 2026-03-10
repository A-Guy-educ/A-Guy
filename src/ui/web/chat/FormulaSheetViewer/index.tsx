'use client'

/**
 * Formula Sheet Viewer Component
 *
 * Displays formula sheet content - either rich text with LaTeX or PDF.
 * On mobile: full-screen drawer from bottom
 * On desktop: modal/side panel overlay
 */

import { X, AlertCircle } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useState, useEffect } from 'react'
import { cn } from '@/infra/utils/ui'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { PDFMedia } from '@/ui/web/media/PDFMedia'
import type { FormulaSheetData } from '../FormulaSheetButton'

interface FormulaSheetViewerProps {
  sheet: FormulaSheetData | null
  isOpen: boolean
  onClose: () => void
}

export function FormulaSheetViewer({ sheet, isOpen, onClose }: FormulaSheetViewerProps) {
  const t = useTranslations('courses')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Don't render if not open or no sheet
  if (!isOpen || !sheet) {
    return null
  }

  // Handle missing PDF
  if (sheet.kind === 'pdf' && sheet.pdfStatus === 'missing') {
    return (
      <div
        className={cn(
          'fixed z-50 bg-background border border-border shadow-lg',
          isMobile
            ? 'inset-0 top-auto h-full max-h-[90vh] rounded-t-2xl'
            : 'inset-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[80vh] rounded-xl',
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">{sheet.name}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={t('formulaSheetClose')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <p className="text-muted-foreground">{t('formulaSheetError')}</p>
        </div>
      </div>
    )
  }

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">{sheet.name}</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={t('formulaSheetClose')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {sheet.kind === 'richtext' && sheet.content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MathMarkdown content={JSON.stringify(sheet.content)} />
          </div>
        ) : sheet.kind === 'pdf' && sheet.pdfFile ? (
          <div className="h-full min-h-[500px]">
            <PDFMedia
              resource={sheet.pdfFile.url || sheet.pdfFile.filename || undefined}
              className="h-full min-h-[500px]"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-muted-foreground">{t('formulaSheetError')}</p>
          </div>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="flex flex-col h-full">{content}</div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border shadow-lg rounded-xl w-full max-w-3xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
