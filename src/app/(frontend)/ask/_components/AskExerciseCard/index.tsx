'use client'

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
    <div className="rounded-3xl overflow-hidden mb-6 shadow-sm border border-border bg-card">
      <div className="aspect-video relative overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={file.title} className="w-full h-full object-contain" />
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">{file.title}</h3>
            <p className="text-muted-foreground text-xs mt-1">{file.date}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleHint}
              disabled={file.isUploading}
              className={cn(
                'p-2 rounded-xl transition-colors disabled:opacity-40',
                'bg-amber-50 text-amber-600 hover:bg-amber-100',
                'dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50',
              )}
              aria-label={`${file.title} - hint`}
            >
              <Lightbulb className="w-5 h-5" />
            </button>
            <button
              onClick={handleSolution}
              disabled={file.isUploading}
              className={cn(
                'p-2 rounded-xl transition-colors disabled:opacity-40',
                'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
                'dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-950/50',
              )}
              aria-label={`${file.title} - solution`}
            >
              <Award className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all',
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
