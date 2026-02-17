/**
 * Block Sanitizer for Interactive Demo
 *
 * Strips answers and sensitive data from blocks before sending to client.
 */

import type { ScriptBlock } from '../../collections/Lessons/interactive-demo-schema'

export interface ClientBlock {
  id: string
  type: 'content' | 'mcq' | 'open'
  content: ClientRichText
  options?: ClientMcqOption[]
  media?: string
}

export interface ClientRichText {
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds: string[]
}

export interface ClientMcqOption {
  id: string
  content: ClientRichText
}

export function sanitizeBlockForClient(block: ScriptBlock): ClientBlock {
  switch (block.type) {
    case 'content':
      return {
        id: block.id,
        type: 'content',
        content: block.content,
        media: block.media,
      }
    case 'mcq':
      return {
        id: block.id,
        type: 'mcq',
        content: block.prompt,
        options: block.options.map((opt) => ({
          id: opt.id,
          content: opt.content,
        })),
        media: block.media,
      }
    case 'open':
      return {
        id: block.id,
        type: 'open',
        content: block.prompt,
        media: block.media,
      }
    default: {
      // Handle unknown block types gracefully
      const _exhaustive: never = block
      console.warn('Unknown block type:', _exhaustive)
      return { type: 'unknown' } as unknown as ClientBlock
    }
  }
}
