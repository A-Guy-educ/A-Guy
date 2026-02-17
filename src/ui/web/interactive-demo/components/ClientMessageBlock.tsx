'use client'

import type { ClientMessage } from '../types'
import { BlockCard } from './BlockCard'

interface ClientMessageBlockProps {
  message: ClientMessage
}

export function ClientMessageBlock({ message }: ClientMessageBlockProps) {
  return (
    <BlockCard label="You" role="user">
      <div className="text-foreground leading-relaxed">{message.content.value}</div>
    </BlockCard>
  )
}
