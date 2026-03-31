/**
 * FormulaSheetContent
 *
 * @fileType component
 * @domain formula-sheets
 * @pattern content-renderer
 * @ai-summary Client-side renderer for formula sheet content (PDF or HTML blocks)
 */

'use client'

import Image from 'next/image'
import type { FormulaSheet } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { PDFEmbed } from '../../courses/PDFViewer/PDFEmbed'

export interface FormulaSheetContentProps {
  /** The formula sheet to render */
  sheet: FormulaSheet
}

/**
 * Render the content of a formula sheet based on its content type.
 *
 * This is a CLIENT component that avoids importing RenderBlocks or RichText
 * (which transitively pull in payload.config.ts → Node.js binary modules).
 * Instead, it renders HTML blocks directly via dangerouslySetInnerHTML.
 */
export function FormulaSheetContent({ sheet }: FormulaSheetContentProps) {
  const { contentType, pdfFile, bodyBlocks } = sheet
  const t = useTranslations('courses')

  switch (contentType) {
    case 'pdf':
      if (!pdfFile || typeof pdfFile === 'string') {
        return <p className="text-muted-foreground">{t('formulaSheetEmpty')}</p>
      }
      return <PDFEmbed pdfUrl={pdfFile.url || `/media/${pdfFile.filename}`} title={sheet.title} />

    case 'richText':
    case 'blocks':
    default: {
      // For blocks, extract HTML content and render directly
      if (!bodyBlocks || !Array.isArray(bodyBlocks) || bodyBlocks.length === 0) {
        return <p className="text-muted-foreground">{t('formulaSheetEmpty')}</p>
      }

      return (
        <div className="formula-sheet-blocks space-y-4">
          {bodyBlocks.map((block, index) => {
            if (block.blockType === 'html' && 'html' in block) {
              return (
                <div
                  key={block.id ?? index}
                  className="rich-text-content"
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              )
            }
            if (block.blockType === 'mediaBlock' && 'media' in block) {
              const media = typeof block.media === 'string' ? null : block.media
              if (media?.url) {
                return (
                  <div key={block.id ?? index} className="rounded-lg overflow-hidden">
                    {media.mimeType?.startsWith('image/') ? (
                      <Image
                        src={media.url}
                        alt={media.alt || ''}
                        width={media.width || 800}
                        height={media.height || 600}
                        className="w-full h-auto"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    ) : (
                      <a href={media.url} className="text-primary underline">
                        {media.filename || 'Download'}
                      </a>
                    )}
                  </div>
                )
              }
            }
            // For content blocks, try to extract rich text
            if (block.blockType === 'content' && 'columns' in block) {
              return (
                <div key={block.id ?? index} className="prose dark:prose-invert max-w-none">
                  {/* Content blocks have complex structure - skip for now */}
                </div>
              )
            }
            return null
          })}
        </div>
      )
    }
  }
}
