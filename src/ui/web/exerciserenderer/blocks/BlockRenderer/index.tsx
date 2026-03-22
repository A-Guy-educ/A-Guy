import type { RichTextBlock } from '@/infra/contracts'
import type { PreviewMode } from '../../types'
import { RichTextRenderer } from '../RichTextRenderer'

interface BlockRendererProps {
  block: RichTextBlock
  mode?: PreviewMode
  availableAssets?: Record<string, string>
}

/**
 * BlockRenderer - Strict: Only supports RichTextBlock
 */
export function BlockRenderer({ block, mode = 'student' }: BlockRendererProps) {
  if (block.type !== 'rich_text') {
    return (
      <div className="flex flex-col gap-content-gap-xs p-card-padding-sm bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-yellow-700 dark:text-yellow-300">
        <span className="text-heading-xl">⚠️</span>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <span>Invalid block type: {(block as any).type}. Only rich_text is supported.</span>
        {mode === 'debug' && (
          <code className="text-body-xs font-mono bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(block, null, 2)}
          </code>
        )}
      </div>
    )
  }

  return <RichTextRenderer block={block} />
}
