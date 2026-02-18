'use client'

import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import type { ClientBlock } from '../types'
import { BlockCard } from './BlockCard'

interface ContentBlockProps {
  block: ClientBlock & { type: 'content' }
}

export function ContentBlock({ block }: ContentBlockProps) {
  return (
    <BlockCard label="A-Guy" role="assistant">
      <MathMarkdown
        content={block.content.value}
        className="rich-text-content leading-relaxed text-foreground"
      />
    </BlockCard>
  )
}
