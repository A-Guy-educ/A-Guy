'use client'

import { Textarea } from '@/ui/web/components/textarea'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import type { ClientBlock } from '../types'

interface OpenBlockProps {
  block: ClientBlock & { type: 'open' }
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function OpenBlock({ block, value, onChange, disabled }: OpenBlockProps) {
  const placeholder = block.content?.value || 'Type your answer...'

  return (
    <div className="interactive-demo-open">
      <div className="mb-4">
        <MathMarkdown
          content={block.content.value}
          className="text-base font-medium text-foreground leading-relaxed"
        />
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[120px] resize-y"
      />
    </div>
  )
}
