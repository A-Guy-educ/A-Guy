'use client'

import type { ClientBlock } from '../types'
import { BlockReveal } from './BlockReveal'
import { ClientMessageBlock } from './ClientMessageBlock'
import { ContentBlock } from './ContentBlock'
import { McqBlock } from './McqBlock'
import { OpenBlock } from './OpenBlock'
import { RemediationBubble } from './RemediationBubble'

interface BlockStreamProps {
  blocks: ClientBlock[]
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
  // Count server blocks to map currentBlockIndex to actual block position
  let serverBlockCount = 0
  const blockMetadata = blocks.map((block) => {
    const isServerBlock = block.type !== 'client_message'
    const serverIndex = isServerBlock ? serverBlockCount : -1
    if (isServerBlock) serverBlockCount++
    return { isServerBlock, serverIndex }
  })

  const renderBlock = (block: ClientBlock, index: number) => {
    const { isServerBlock, serverIndex } = blockMetadata[index]
    const isClientMessage = block.type === 'client_message'

    // All blocks that have been added should be shown
    // (They're added sequentially as they arrive or are created)

    // Handle client message blocks
    if (isClientMessage) {
      return (
        <div key={`block-${block.id}`} className="mb-4">
          <BlockReveal typewriterEnabled={false} delay={0}>
            <ClientMessageBlock message={block as ClientBlock & { type: 'client_message' }} />
          </BlockReveal>
        </div>
      )
    }

    // For server blocks, determine if this is the current one
    const isCurrentBlock = isServerBlock && serverIndex === currentBlockIndex

    // Handle regular lesson blocks
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
      <div key={`block-${block.id}`} className="mb-4">
        <BlockReveal
          typewriterEnabled={typewriterEnabled && isCurrentBlock}
          delay={0}
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
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}
