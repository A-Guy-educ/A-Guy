'use client'

import { TelescopeLogo } from '@/components/TelescopeLogo'
import { useLocale, useTranslations } from '@/providers/I18n'
import { cn } from '@/utilities/ui'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl: string
}

export function ExerciseHeader({ exerciseTitle, backUrl }: ExerciseHeaderProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const isRTL = locale === 'he'

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center flex-shrink-0 z-[100] relative">
      {/* Left side in LTR (back arrow) / Right side in RTL (back arrow) */}
      <Link
        href={backUrl}
        className={cn(
          'flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors flex-shrink-0 absolute',
          isRTL ? 'right-5' : 'left-5',
        )}
        aria-label={t('backToLesson')}
      >
        {isRTL ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
      </Link>

      {/* Center: Exercise Title */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight cursor-move max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      {/* Right side in LTR (logo + text) / Left side in RTL (logo + text) - Fixed positioning to viewport edge */}
      <div
        className={cn(
          'flex items-center gap-1 flex-shrink-0 fixed top-[10px] z-[101]',
          isRTL ? 'flex-row-reverse' : 'flex-row',
        )}
        style={{
          [isRTL ? 'left' : 'right']: '20px',
        }}
      >
        <TelescopeLogo className="h-8 w-auto" />
        <span className="text-primary text-xl font-extrabold tracking-tight">Aguy</span>
      </div>
    </header>
  )
}
