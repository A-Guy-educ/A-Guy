'use client'

import type { ClientBlock } from '../types'
import { BlockReveal } from './BlockReveal'
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  t,
}: BlockStreamProps) {
  const renderBlock = (block: ClientBlock, index: number) => {
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
      <div key={block.id} className="mb-6">
        <BlockReveal typewriterEnabled={typewriterEnabled} delay={index * 200}>
          {blockContent}
        </BlockReveal>

        {/* Show remediation after current block if available */}
        {isCurrentBlock && remediation && <RemediationBubble remediation={remediation} />}
      </div>
    )
  }

  return (
    <div className="interactive-demo-block-stream space-y-6">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}
