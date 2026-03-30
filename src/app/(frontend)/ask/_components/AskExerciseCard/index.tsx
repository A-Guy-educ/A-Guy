'use client'

import Image from 'next/image'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Award, Edit3, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import type { AskActionEvent, ExerciseFile } from '../ask-types'
import { ASK_ACTION_EVENT } from '../ask-types'
import { AskDrawingCanvas } from '../AskDrawingCanvas'

interface AskExerciseCardProps {
  file: ExerciseFile
}

function dispatchAskAction(detail: AskActionEvent) {
  window.dispatchEvent(new CustomEvent(ASK_ACTION_EVENT, { detail }))
}

export function AskExerciseCard({ file }: AskExerciseCardProps) {
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
    <div className="rounded-2xl bg-card border border-border/40 shadow-elevation-1 transition-all duration-normal overflow-hidden border-s-4 border-s-accent hover:shadow-card-hover hover:-translate-y-0.5 mb-6">
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
          <div className="flex gap-2">
            <button
              onClick={handleHint}
              disabled={file.isUploading}
              className={cn(
                'p-2 rounded-xl transition-colors duration-normal disabled:opacity-40',
                'bg-warning/10 text-warning hover:bg-warning/20',
              )}
              aria-label={`${file.title} - hint`}
            >
              <Lightbulb className="w-5 h-5" />
            </button>
            <button
              onClick={handleSolution}
              disabled={file.isUploading}
              className={cn(
                'p-2 rounded-xl transition-colors duration-normal disabled:opacity-40',
                'bg-primary/10 text-primary hover:bg-primary/20',
              )}
              aria-label={`${file.title} - solution`}
            >
              <Award className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all duration-normal',
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
