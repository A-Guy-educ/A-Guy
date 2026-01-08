'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslations, useLocale } from '@/providers/I18n'
import { Logo } from '@/components/Logo/Logo'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl: string
}

export function ExerciseHeader({ exerciseTitle, backUrl }: ExerciseHeaderProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const isRTL = locale === 'he'

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center justify-between px-5 flex-shrink-0 z-[100] relative">
      {/* Left side in LTR (back arrow) / Right side in RTL (back arrow) */}
      <Link
        href={backUrl}
        className="flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors flex-shrink-0"
        aria-label={t('backToLesson')}
      >
        {isRTL ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
      </Link>

      {/* Center: Exercise Title - draggable on mobile */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight cursor-move max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      {/* Right side in LTR (logo) / Left side in RTL (logo) */}
      <div className="flex items-center gap-2 flex-shrink-0 mr-2">
        <span className="text-primary text-xl font-extrabold tracking-tight">Aguy</span>
        <Logo className="h-8 w-auto" />
      </div>
    </header>
  )
}
