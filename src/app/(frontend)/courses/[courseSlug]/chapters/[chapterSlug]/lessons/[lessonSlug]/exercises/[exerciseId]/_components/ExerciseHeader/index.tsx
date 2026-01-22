'use client'

import { TelescopeLogo } from '@/components/TelescopeLogo'
import { isRTL } from '@/i18n/config'
import { useLocale, useTranslations } from '@/providers/I18n'
import { cn } from '@/utilities/ui'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl?: string
}

export function ExerciseHeader({ exerciseTitle, backUrl }: ExerciseHeaderProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else if (backUrl) {
      router.push(backUrl)
    } else {
      router.push('/courses')
    }
  }

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center flex-shrink-0 z-[100] relative">
      {/* Left side in LTR (back arrow) / Right side in RTL (back arrow) */}
      <button
        onClick={handleBack}
        className={cn(
          'flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors flex-shrink-0 absolute cursor-pointer',
          rtl ? 'right-5' : 'left-5',
        )}
        aria-label={t('backToLesson')}
      >
        {rtl ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
      </button>

      {/* Center: Exercise Title */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight cursor-move max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      {/* Right side in LTR (logo + text) / Left side in RTL (logo + text) - Fixed positioning to viewport edge */}
      <div
        className={cn(
          'flex items-center gap-1 flex-shrink-0 fixed top-[10px] z-[101]',
          rtl ? 'flex-row-reverse' : 'flex-row',
        )}
        style={{
          [rtl ? 'left' : 'right']: '20px',
        }}
      >
        <TelescopeLogo className="h-8 w-auto" />
      </div>
    </header>
  )
}
