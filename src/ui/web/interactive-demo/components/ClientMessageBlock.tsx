'use client'

import type { ClientBlock } from '../types'
import { BlockCard } from './BlockCard'

interface ClientMessageBlockProps {
  message: ClientBlock & { type: 'client_message' }
}

export function ClientMessageBlock({ message }: ClientMessageBlockProps) {
  return (
    <BlockCard label="You" role="user">
      <div className="text-foreground leading-relaxed">{message.content.value}</div>
    </BlockCard>
  )
}
