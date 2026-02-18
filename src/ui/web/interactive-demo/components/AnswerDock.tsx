'use client'

import { Button } from '@/ui/web/components/button'
import type { ClientBlock } from '../types'

interface AnswerDockProps {
  currentBlock: ClientBlock
  mcqSelectedAnswer: string | null
  openAnswer: string
  onMcqSelect: (optionId: string) => void
  onOpenChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  t: {
    submit: string
    selectOption: string
    typeAnswer: string
  }
}

export function AnswerDock({
  currentBlock,
  mcqSelectedAnswer,
  openAnswer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMcqSelect,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOpenChange,
  onSubmit,
  isSubmitting,
  t,
}: AnswerDockProps) {
  const isMcq = currentBlock.type === 'mcq'
  const isOpen = currentBlock.type === 'open'
  const canSubmit = isMcq
    ? mcqSelectedAnswer !== null
    : isOpen
      ? openAnswer.trim().length > 0
      : false

  return (
    <div className="mt-4 rounded-[22px] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_18px_40px_rgba(17,24,39,0.06)] p-4">
      <div className="flex items-center justify-between gap-4">
        {isMcq && (
          <div className="text-sm text-muted-foreground">
            {mcqSelectedAnswer === null ? t.selectOption : ''}
          </div>
        )}

        {isOpen && (
          <div className="text-sm text-muted-foreground">
            {openAnswer.length === 0 ? t.typeAnswer : ''}
          </div>
        )}

        <Button
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          size="lg"
          className="min-w-[120px] rounded-full"
        >
          {isSubmitting ? t.submit + '...' : t.submit}
        </Button>
      </div>
    </div>
  )
}
