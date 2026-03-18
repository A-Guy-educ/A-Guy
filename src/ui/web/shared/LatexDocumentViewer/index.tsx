/**
 * @fileType component
 * @domain ui
 * @pattern viewer
 * @ai-summary Renders raw LaTeX source as a typeset academic document with live TikZ diagrams.
 *             Parses tikzpicture environments and renders them as interactive JSXGraph diagrams.
 */

'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import {
  latexToMarkdownWithDiagrams,
  detectDirection,
  type ParsedDiagram,
} from './latex-to-markdown'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'

/** Lazy-loaded AxisRenderer for graph diagrams */
const LazyAxisRenderer = dynamic(
  () =>
    import('@/ui/web/exerciserenderer/blocks/AxisRenderer').then((m) => ({
      default: m.AxisRenderer,
    })),
  {
    ssr: false,
    loading: () => <div className="my-4 h-64 w-full animate-pulse rounded-lg bg-muted" />,
  },
)

/** Lazy-loaded GeometryRenderer for geometry diagrams */
const LazyGeometryRenderer = dynamic(
  () =>
    import('@/ui/web/exerciserenderer/blocks/GeometryRenderer').then((m) => ({
      default: m.GeometryRenderer,
    })),
  {
    ssr: false,
    loading: () => <div className="my-4 h-64 w-full animate-pulse rounded-lg bg-muted" />,
  },
)

function DiagramRenderer({ diagram }: { diagram: ParsedDiagram }) {
  if (diagram.type === 'axis') {
    return <LazyAxisRenderer blockId={diagram.id} spec={diagram.spec as AxisSpecV1} />
  }
  return <LazyGeometryRenderer blockId={diagram.id} spec={diagram.spec as GeometrySpecV1} />
}

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
  const dir = detectDirection(latex)

  const { segments, diagrams } = useMemo(() => latexToMarkdownWithDiagrams(latex), [latex])

  return (
    <div
      dir={dir}
      className={cn(
        'bg-background border-border mx-auto max-w-4xl overflow-auto rounded-lg border shadow-lg',
        className,
      )}
    >
      <div className="px-12 py-10 font-serif sm:px-16 sm:py-12">
        {title && <h1 className="text-foreground mb-8 text-center text-2xl font-bold">{title}</h1>}

        {diagrams.length === 0 ? (
          <MathMarkdown
            content={segments[0]}
            className="rich-text-content latex-document text-foreground text-base leading-relaxed"
          />
        ) : (
          <>
            {segments.map((segment, i) => (
              <React.Fragment key={i}>
                {segment && (
                  <MathMarkdown
                    content={segment}
                    className="rich-text-content latex-document text-foreground text-base leading-relaxed"
                  />
                )}
                {i < diagrams.length && <DiagramRenderer diagram={diagrams[i]} />}
              </React.Fragment>
            ))}
          </>
        )}
      </div>
      {showPrintButton && (
        <div className="fixed bottom-4 right-4 print:hidden">
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
