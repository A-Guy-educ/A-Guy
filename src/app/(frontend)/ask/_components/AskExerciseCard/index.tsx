'use client'

import Image from 'next/image'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Award, Edit3, Lightbulb, Loader2, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { AskActionEvent, ExerciseFile } from '../ask-types'
import { ASK_ACTION_EVENT } from '../ask-types'
import { AskDrawingCanvas } from '../AskDrawingCanvas'

interface AskExerciseCardProps {
  file: ExerciseFile
  onGenerate: () => void
  generationStatus: string
  /** True when a lesson has been generated and is available to resume. */
  hasLesson?: boolean
  /** Re-enter the existing player without regenerating. */
  onResumeLesson?: () => void
  /** Discard the current lesson and image, return to upload view. */
  onStartOver?: () => void
}

function dispatchAskAction(detail: AskActionEvent) {
  window.dispatchEvent(new CustomEvent(ASK_ACTION_EVENT, { detail }))
}

export function AskExerciseCard({
  file,
  onGenerate,
  generationStatus,
  hasLesson,
  onResumeLesson,
  onStartOver,
}: AskExerciseCardProps) {
  const t = useTranslations('homepage.ask')
  const [isOpen, setIsOpen] = useState(false)

  const handleHint = () => {
    dispatchAskAction({ type: 'hint', title: file.title, mediaId: file.mediaId })
  }

  const handleSolution = () => {
    dispatchAskAction({ type: 'solution', title: file.title, mediaId: file.mediaId })
  }

  const handleCheckSolution = (imageData: string) => {
    dispatchAskAction({ type: 'check', title: file.title, imageData, mediaId: file.mediaId })
  }

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-elevation-1 transition-all duration-normal overflow-hidden border-s-4 border-s-accent mb-6">
      <div className="aspect-video relative overflow-hidden bg-muted">
        <Image
          src={file.url}
          alt={file.title}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      <div className="p-5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-content-gap">
          <div>
            <h3 className="text-heading-md font-bold text-card-foreground">{file.title}</h3>
            <p className="text-body-sm text-muted-foreground mt-1">{file.date}</p>
          </div>
          <div className="flex gap-content-gap-xs flex-wrap">
            <ActionButton
              onClick={handleHint}
              disabled={file.isUploading}
              variant="warning"
              label={`${file.title} - hint`}
            >
              <Lightbulb className="w-5 h-5" />
            </ActionButton>
            <ActionButton
              onClick={handleSolution}
              disabled={file.isUploading}
              variant="primary"
              label={`${file.title} - solution`}
            >
              <Award className="w-5 h-5" />
            </ActionButton>
            {hasLesson && onResumeLesson ? (
              <>
                <ActionButton
                  onClick={onResumeLesson}
                  disabled={file.isUploading}
                  variant="accent"
                  label={t('resumeLesson')}
                >
                  <Play className="w-5 h-5" />
                </ActionButton>
                {onStartOver && (
                  <ActionButton
                    onClick={onStartOver}
                    disabled={file.isUploading}
                    variant="warning"
                    label={t('startOver')}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </ActionButton>
                )}
              </>
            ) : (
              <ActionButton
                onClick={onGenerate}
                disabled={file.isUploading || !file.mediaId || generationStatus === 'generating'}
                variant="accent"
                label={t('generateLesson')}
              >
                {generationStatus === 'generating' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </ActionButton>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
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

        {isOpen && <AskDrawingCanvas onCheckSolution={handleCheckSolution} />}
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
