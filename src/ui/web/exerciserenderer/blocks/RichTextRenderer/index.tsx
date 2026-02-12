/**
 * Rich Text Renderer
 * Renders markdown with math support (KaTeX) using the shared MathMarkdown component.
 */

import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'

interface RichTextRendererProps {
  block: {
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
    mediaIds?: string[]
  }
}

export function RichTextRenderer({ block }: RichTextRendererProps) {
  return (
    <MathMarkdown
      content={block.value}
      className="rich-text-content leading-relaxed text-foreground"
    />
  )
}
