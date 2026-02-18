'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Spinner } from '@/ui/web/shared/Loading/Spinner'
import { Heading } from '@/ui/web/shared/Typography/Heading'
import { useEffect, useState } from 'react'
import { AnswerDock } from './components/AnswerDock'
import { BlockStream } from './components/BlockStream'
import { ContinueButton } from './components/ContinueButton'
import { DemoSidebar } from './components/DemoSidebar'
import { ProgressBar } from './components/ProgressBar'
import { SessionControls } from './components/SessionControls'
import { useInteractiveSession } from './hooks/useInteractiveSession'

interface InteractiveDemoViewProps {
  lessonId: string
  lessonTitle: string
  backUrl: string
  typewriterEnabled: boolean
}

export function InteractiveDemoView({
  lessonId,
  lessonTitle,
  backUrl,
  typewriterEnabled,
}: InteractiveDemoViewProps) {
  const t = useTranslations('interactiveDemo')
  const {
    status,
    sessionId,
    currentBlockIndex,
    currentPhase,
    blocks,
    skillScore,
    remediation,
    isSubmitting,
    totalBlocks,
    eventLog,
    start,
    submitAnswer,
    next,
    reset,
    addClientBlock,
  } = useInteractiveSession(lessonId, lessonTitle)

  const [mcqSelectedAnswer, setMcqSelectedAnswer] = useState<string | null>(null)
  const [openAnswer, setOpenAnswer] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [finishTypingFn, setFinishTypingFn] = useState<(() => void) | null>(null)

  const handleTypingStateChange = (typing: boolean, finishFn: () => void) => {
    setIsTyping(typing)
    setFinishTypingFn(() => finishFn)
  }

  // Start the session on mount
  useEffect(() => {
    start()
  }, [start])

  // Reset answer state when moving to a new block
  useEffect(() => {
    setMcqSelectedAnswer(null)
    setOpenAnswer('')
  }, [currentBlockIndex])

  const handleSubmit = async () => {
    const currentBlock = blocks[currentBlockIndex]
    if (!currentBlock) return

    if (currentBlock.type === 'mcq' && mcqSelectedAnswer) {
      // Find the selected option text
      const selectedOption = currentBlock.options?.find((opt) => opt.id === mcqSelectedAnswer)
      if (selectedOption) {
        addClientBlock(selectedOption.content.value)
      }
      await submitAnswer({ selected: mcqSelectedAnswer })
    } else if (currentBlock.type === 'open' && openAnswer.trim()) {
      addClientBlock(openAnswer.trim())
      await submitAnswer(openAnswer.trim())
    }
  }

  const handleNext = async () => {
    // If typing is in progress, finish it first
    if (isTyping && finishTypingFn) {
      finishTypingFn()
      return
    }

    await next()
  }

  const handleReset = async () => {
    await reset()
    setMcqSelectedAnswer(null)
    setOpenAnswer('')
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  const currentBlock = blocks[currentBlockIndex]
  const showAnswerDock = currentPhase === 'awaiting_input' && currentBlock
  const showContinueButton = currentPhase === 'awaiting_continue'

  const translations = {
    submit: t('submit'),
    selectOption: t('selectOption'),
    typeAnswer: t('typeAnswer'),
    continue: t('continue'),
    reset: t('reset'),
    resetConfirm: t('resetConfirm'),
  }

  // Calculate progress percentage
  const progressValue = totalBlocks > 0 ? ((currentBlockIndex + 1) / totalBlocks) * 100 : 0

  return (
    <div className="interactive-demo-view min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-2xl border-b border-border px-4 py-3">
        <div className="container max-w-[1100px] mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <a href={backUrl} className="text-sm text-muted-foreground hover:text-foreground">
                ← Back
              </a>
              <Heading level="h2" className="text-lg font-semibold">
                {lessonTitle}
              </Heading>
            </div>

            <div className="flex items-center gap-4">
              {/* Skill score badge */}
              <div className="text-sm text-muted-foreground">
                {t('score')}: {skillScore}
              </div>

              {/* Reset button */}
              <SessionControls onReset={handleReset} t={translations} />
            </div>
          </div>
        </div>
      </header>

      {/* Progress bar directly under header */}
      {totalBlocks > 0 && (
        <div className="sticky top-[73px] z-30 bg-background/50 backdrop-blur-sm">
          <div className="h-1.5 bg-border/40">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>
      )}

      {/* Main content - two column layout */}
      <main className="max-w-[1100px] mx-auto px-4 py-4">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Left: Block stream */}
          <div className="min-w-0">
            <BlockStream
              blocks={blocks}
              typewriterEnabled={typewriterEnabled}
              currentBlockIndex={currentBlockIndex}
              currentPhase={currentPhase}
              mcqSelectedAnswer={mcqSelectedAnswer}
              openAnswer={openAnswer}
              onMcqSelect={setMcqSelectedAnswer}
              onOpenChange={setOpenAnswer}
              isSubmitting={isSubmitting}
              remediation={remediation}
              onTypingStateChange={handleTypingStateChange}
              t={translations}
            />

            {/* Completion message */}
            {status === 'completed' && (
              <div className="text-center py-12">
                <Heading level="h2" className="text-2xl font-bold mb-4">
                  {t('completed')}
                </Heading>
                <p className="text-muted-foreground">
                  {t('score')}: {skillScore}
                </p>
              </div>
            )}
          </div>

          {/* Right: DemoSidebar */}
          <aside className="hidden lg:block">
            <DemoSidebar
              skillScore={skillScore}
              blocksShown={blocks.length}
              currentPhase={currentPhase}
              sessionId={sessionId}
              eventLog={eventLog}
            />
          </aside>
        </div>
      </main>

      {/* Bottom dock */}
      {showAnswerDock && currentBlock && (
        <AnswerDock
          currentBlock={currentBlock}
          mcqSelectedAnswer={mcqSelectedAnswer}
          openAnswer={openAnswer}
          onMcqSelect={setMcqSelectedAnswer}
          onOpenChange={setOpenAnswer}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          t={translations}
        />
      )}

      {/* Continue button */}
      {showContinueButton && <ContinueButton onClick={handleNext} t={translations} />}
    </div>
  )
}
