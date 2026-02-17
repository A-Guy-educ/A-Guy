'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Spinner } from '@/ui/web/shared/Loading/Spinner'
import { Heading } from '@/ui/web/shared/Typography/Heading'
import { useEffect, useState } from 'react'
import { AnswerDock } from './components/AnswerDock'
import { BlockStream } from './components/BlockStream'
import { ContinueButton } from './components/ContinueButton'
import { SessionControls } from './components/SessionControls'
import { SessionSidebar } from './components/SessionSidebar'
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
    clientMessages,
    skillScore,
    remediation,
    isSubmitting,
    start,
    submitAnswer,
    next,
    reset,
    addClientMessage,
  } = useInteractiveSession(lessonId, lessonTitle)

  const [mcqSelectedAnswer, setMcqSelectedAnswer] = useState<string | null>(null)
  const [openAnswer, setOpenAnswer] = useState('')
  const [events, setEvents] = useState<Array<{ action: string; timestamp: string }>>([])

  // Track events for sidebar
  const addEvent = (action: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setEvents((prev) => [{ action, timestamp }, ...prev].slice(0, 5))
  }

  // Start the session on mount
  useEffect(() => {
    start().then(() => addEvent('start'))
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
        addClientMessage(selectedOption.content.value)
      }
      await submitAnswer({ selected: mcqSelectedAnswer })
      addEvent('answer')
    } else if (currentBlock.type === 'open' && openAnswer.trim()) {
      addClientMessage(openAnswer.trim())
      await submitAnswer(openAnswer.trim())
      addEvent('answer')
    }
  }

  const handleNext = async () => {
    await next()
    addEvent('next')
  }

  const handleReset = async () => {
    await reset()
    setMcqSelectedAnswer(null)
    setOpenAnswer('')
    setEvents([])
    addEvent('reset')
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

  return (
    <div className="interactive-demo-view min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3">
        <div className="container max-w-4xl mx-auto flex items-center justify-between">
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
      </header>

      {/* Main content - two column layout */}
      <main className="container max-w-7xl mx-auto px-4 py-6 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Left: Block stream */}
          <div className="min-w-0">
            <BlockStream
              blocks={blocks}
              clientMessages={clientMessages}
              typewriterEnabled={typewriterEnabled}
              currentBlockIndex={currentBlockIndex}
              currentPhase={currentPhase}
              mcqSelectedAnswer={mcqSelectedAnswer}
              openAnswer={openAnswer}
              onMcqSelect={setMcqSelectedAnswer}
              onOpenChange={setOpenAnswer}
              isSubmitting={isSubmitting}
              remediation={remediation}
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

          {/* Right: Sidebar */}
          <aside className="hidden lg:block">
            <SessionSidebar
              skillScore={skillScore}
              blocksShown={blocks.length}
              currentPhase={currentPhase}
              sessionId={sessionId}
              events={events}
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
