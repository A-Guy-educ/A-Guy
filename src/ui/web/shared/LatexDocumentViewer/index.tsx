/**
 * @fileType component
 * @domain ui
 * @pattern viewer
 * @ai-summary Renders raw LaTeX source as a typeset academic document, similar to PDFMedia for PDFs
 */

'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { latexToMarkdown } from './latex-to-markdown'

export interface LatexDocumentViewerProps {
  /** Raw LaTeX source text to render */
  latex: string
  /** Optional document title displayed above content */
  title?: string
  /** Additional CSS classes for the outer container */
  className?: string
  /** Whether to show the print button (default: true) */
  showPrintButton?: boolean
}

export function LatexDocumentViewer({
  latex,
  title,
  className,
  showPrintButton = true,
}: LatexDocumentViewerProps) {
  const t = useTranslations('exercises')
  const markdown = latexToMarkdown(latex)

  return (
    <div
      className={cn(
        'bg-background border-border mx-auto max-w-4xl rounded-lg border shadow-lg',
        className,
      )}
    >
      <div className="px-12 py-10 font-serif sm:px-16 sm:py-12">
        {title && <h1 className="text-foreground mb-8 text-center text-2xl font-bold">{title}</h1>}
        <MathMarkdown
          content={markdown}
          className="rich-text-content latex-document text-foreground text-base leading-relaxed"
        />
      </div>
      {showPrintButton && (
        <div className="print:hidden fixed bottom-4 right-4">
          <button
            onClick={() => window.print()}
            className={cn(
              'bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm',
              'hover:bg-primary/90 transition-colors',
            )}
          >
            {t('printDocument')}
          </button>
        </div>
      )}
    </div>
  )
}
