'use client'

import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import type { ClientBlock } from '../types'

interface ContentBlockProps {
  block: ClientBlock & { type: 'content' }
}

export function ContentBlock({ block }: ContentBlockProps) {
  return (
    <div className="interactive-demo-content">
      <MathMarkdown
        content={block.content.value}
        className="rich-text-content leading-relaxed text-foreground"
      />
    </div>
  )
}
