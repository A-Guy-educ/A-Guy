/**
 * Rich Text Renderer
 * Renders markdown with math support (KaTeX) using the shared MathMarkdown component.
 */

import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { preprocessNewlines } from '@/infra/utils/textPreprocessing'

interface RichTextRendererProps {
  block: {
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
    mediaIds?: string[]
  }
}

export function RichTextRenderer({ block }: RichTextRendererProps) {
  const processedValue = preprocessNewlines(block.value)

  return (
    <MathMarkdown
      content={processedValue}
      className="rich-text-content leading-relaxed text-foreground"
    />
  )
}
