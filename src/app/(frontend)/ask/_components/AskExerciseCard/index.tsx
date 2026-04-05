'use client'

import Image from 'next/image'
import { cn } from '@/infra/utils/ui'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { Award, Edit3, Lightbulb, Loader2, Play } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { AskActionEvent, AskStepChangeEvent, ExerciseFile } from '../ask-types'
import { ASK_ACTION_EVENT, ASK_STEP_CHANGE_EVENT } from '../ask-types'
import { AskDrawingCanvas } from '../AskDrawingCanvas'
import { InteractivePlayer } from '../InteractivePlayer'
import { useGenerateLesson } from '../InteractivePlayer/useGenerateLesson'

interface AskExerciseCardProps {
  file: ExerciseFile
}

function dispatchAskAction(detail: AskActionEvent) {
  window.dispatchEvent(new CustomEvent(ASK_ACTION_EVENT, { detail }))
}

function dispatchStepChange(detail: AskStepChangeEvent) {
  window.dispatchEvent(new CustomEvent(ASK_STEP_CHANGE_EVENT, { detail }))
}

export function AskExerciseCard({ file }: AskExerciseCardProps) {
  const t = useTranslations('homepage.ask')
  const locale = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const { lesson, status, error, generate } = useGenerateLesson()

  const handleHint = () => {
    dispatchAskAction({ type: 'hint', title: file.title, mediaId: file.mediaId })
  }

  const handleSolution = () => {
    dispatchAskAction({ type: 'solution', title: file.title, mediaId: file.mediaId })
  }

  const handleCheckSolution = (imageData: string) => {
    dispatchAskAction({ type: 'check', title: file.title, imageData, mediaId: file.mediaId })
  }

  const handleGenerate = () => {
    if (!file.mediaId || status === 'generating') return
    const loc = locale === 'he' ? 'he' : 'en'
    generate(file.mediaId, loc)
  }

  const handleStepChange = useCallback(
    (stepId: number) => {
      if (!lesson) return
      const step = lesson.steps.find((s) => s.id === stepId)
      if (!step) return
      dispatchStepChange({
        stepId,
        totalSteps: lesson.steps.length,
        stepTitle: step.title,
        stepNarration: step.narration,
      })
    },
    [lesson],
  )

  const showPlayer = status === 'done' && lesson

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-elevation-1 transition-all duration-normal overflow-hidden border-s-4 border-s-accent mb-6">
      {/* Image or Player */}
      {showPlayer ? (
        <div className="h-[400px]">
          <InteractivePlayer lesson={lesson} onStepChange={handleStepChange} />
        </div>
      ) : (
        <ExerciseImage file={file} />
      )}

      {/* Generation loading/error state */}
      {status === 'generating' && <GeneratingOverlay t={t} />}
      {status === 'error' && error && <ErrorBanner message={error} />}

      {/* Action buttons */}
      <ExerciseActions
        file={file}
        isOpen={isOpen}
        showPlayer={!!showPlayer}
        status={status}
        t={t}
        onHint={handleHint}
        onSolution={handleSolution}
        onToggleNotebook={() => setIsOpen(!isOpen)}
        onGenerate={handleGenerate}
      />

      {isOpen && <AskDrawingCanvas onCheckSolution={handleCheckSolution} />}
    </div>
  )
}

function ExerciseImage({ file }: { file: ExerciseFile }) {
  return (
    <div className="aspect-video relative overflow-hidden bg-muted">
      <Image
        src={file.url}
        alt={file.title}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
    </div>
  )
}

function GeneratingOverlay({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-primary/5 border-t border-border">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
      <span className="text-body-sm font-medium text-primary">{t('generatingLesson')}</span>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-5 py-3 bg-error/5 border-t border-border">
      <p className="text-body-sm text-error">{message}</p>
    </div>
  )
}

interface ExerciseActionsProps {
  file: ExerciseFile
  isOpen: boolean
  showPlayer: boolean
  status: string
  t: ReturnType<typeof useTranslations>
  onHint: () => void
  onSolution: () => void
  onToggleNotebook: () => void
  onGenerate: () => void
}

function ExerciseActions({
  file,
  isOpen,
  showPlayer,
  status,
  t,
  onHint,
  onSolution,
  onToggleNotebook,
  onGenerate,
}: ExerciseActionsProps) {
  return (
    <div className="p-5">
      <div className="flex flex-col md:flex-row justify-between items-center gap-content-gap">
        <div>
          <h3 className="text-heading-md font-bold text-card-foreground">{file.title}</h3>
          <p className="text-body-sm text-muted-foreground mt-1">{file.date}</p>
        </div>
        <div className="flex gap-content-gap-xs flex-wrap">
          <ActionButton
            onClick={onHint}
            disabled={file.isUploading}
            variant="warning"
            label={`${file.title} - hint`}
          >
            <Lightbulb className="w-5 h-5" />
          </ActionButton>
          <ActionButton
            onClick={onSolution}
            disabled={file.isUploading}
            variant="primary"
            label={`${file.title} - solution`}
          >
            <Award className="w-5 h-5" />
          </ActionButton>
          {!showPlayer && (
            <ActionButton
              onClick={onGenerate}
              disabled={file.isUploading || !file.mediaId || status === 'generating'}
              variant="accent"
              label={t('generateLesson')}
            >
              {status === 'generating' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </ActionButton>
          )}
          <button
            onClick={onToggleNotebook}
            className={cn(
              'flex items-center gap-content-gap-xs px-5 py-2 rounded-xl font-bold transition-all duration-normal',
              isOpen
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            <Edit3 className="w-4 h-4" />
            {isOpen ? t('closeNotebook') : t('openNotebook')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  variant,
  label,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  variant: 'warning' | 'primary' | 'accent'
  label: string
  children: React.ReactNode
}) {
  const colors = {
    warning: 'bg-warning/10 text-warning hover:bg-warning/20',
    primary: 'bg-primary/10 text-primary hover:bg-primary/20',
    accent: 'bg-accent/10 text-accent hover:bg-accent/20',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-2 rounded-xl transition-colors duration-normal disabled:opacity-40',
        colors[variant],
      )}
      aria-label={label}
    >
      {children}
    </button>
  )
}
