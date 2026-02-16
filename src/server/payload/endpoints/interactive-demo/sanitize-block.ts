/**
 * Block Sanitizer for Interactive Demo
 *
 * Strips answers and sensitive data from blocks before sending to client.
 */

import type { ScriptBlock } from '../../collections/Lessons/interactive-demo-schema'

interface ClientBlock {
  type: string
  content?: object
  options?: object[]
  media?: string
}

export function sanitizeBlockForClient(block: ScriptBlock): ClientBlock {
  switch (block.type) {
    case 'content':
      return {
        type: 'content',
        content: block.content,
        media: block.media,
      }
    case 'mcq':
      return {
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
        type: 'open',
        content: block.prompt,
        media: block.media,
      }
    default: {
      // Handle unknown block types gracefully
      const _exhaustive: never = block
      console.warn('Unknown block type:', _exhaustive)
      return { type: 'unknown' }
    }
  }
}
