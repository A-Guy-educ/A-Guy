'use client'

import type { ClientBlock, ClientMessage } from '../types'
import { BlockReveal } from './BlockReveal'
import { ClientMessageBlock } from './ClientMessageBlock'
import { ContentBlock } from './ContentBlock'
import { McqBlock } from './McqBlock'
import { OpenBlock } from './OpenBlock'
import { RemediationBubble } from './RemediationBubble'

interface BlockStreamProps {
  blocks: ClientBlock[]
  clientMessages: ClientMessage[]
  typewriterEnabled: boolean
  currentBlockIndex: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' | null
  mcqSelectedAnswer: string | null
  openAnswer: string
  onMcqSelect: (optionId: string) => void
  onOpenChange: (value: string) => void
  isSubmitting: boolean
  remediation: string | null
  onTypingStateChange?: (isTyping: boolean, finishTyping: () => void) => void
  t: {
    selectOption: string
    typeAnswer: string
  }
}

export function BlockStream({
  blocks,
  clientMessages,
  typewriterEnabled,
  currentBlockIndex,
  currentPhase,
  mcqSelectedAnswer,
  openAnswer,
  onMcqSelect,
  onOpenChange,
  isSubmitting,
  remediation,
  onTypingStateChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  t,
}: BlockStreamProps) {
  // Merge blocks and client messages, sorted by their insertion order
  const allItems: Array<
    { type: 'block'; data: ClientBlock; index: number } | { type: 'message'; data: ClientMessage }
  > = [
    ...blocks.map((block, index) => ({ type: 'block' as const, data: block, index })),
    ...clientMessages.map((message) => ({ type: 'message' as const, data: message })),
  ]

  const renderItem = (
    item:
      | { type: 'block'; data: ClientBlock; index: number }
      | { type: 'message'; data: ClientMessage },
  ) => {
    if (item.type === 'message') {
      return (
        <div key={item.data.id} className="mb-4">
          <BlockReveal typewriterEnabled={false} delay={0}>
            <ClientMessageBlock message={item.data} />
          </BlockReveal>
        </div>
      )
    }

    const block = item.data
    const index = item.index
    const isCurrentBlock = index === currentBlockIndex
    const isPastBlock = index < currentBlockIndex
    const showBlock = isPastBlock || isCurrentBlock

    if (!showBlock) return null

    const blockContent = (() => {
      switch (block.type) {
        case 'content':
          return <ContentBlock block={block as Extract<ClientBlock, { type: 'content' }>} />
        case 'mcq':
          return (
            <McqBlock
              block={block as Extract<ClientBlock, { type: 'mcq' }>}
              selectedAnswer={mcqSelectedAnswer}
              onSelect={onMcqSelect}
              disabled={!isCurrentBlock || currentPhase !== 'awaiting_input' || isSubmitting}
            />
          )
        case 'open':
          return (
            <OpenBlock
              block={block as Extract<ClientBlock, { type: 'open' }>}
              value={openAnswer}
              onChange={onOpenChange}
              disabled={!isCurrentBlock || currentPhase !== 'awaiting_input' || isSubmitting}
            />
          )
        default:
          return null
      }
    })()

    return (
      <div key={block.id} className="mb-4">
        <BlockReveal
          typewriterEnabled={typewriterEnabled && isCurrentBlock}
          delay={index * 200}
          onTypingStateChange={isCurrentBlock ? onTypingStateChange : undefined}
        >
          {blockContent}
        </BlockReveal>

        {/* Show remediation after current block if available */}
        {isCurrentBlock && remediation && <RemediationBubble remediation={remediation} />}
      </div>
    )
  }

  return (
    <div className="interactive-demo-block-stream space-y-4">
      {allItems.map((item) => renderItem(item))}
    </div>
  )
}
