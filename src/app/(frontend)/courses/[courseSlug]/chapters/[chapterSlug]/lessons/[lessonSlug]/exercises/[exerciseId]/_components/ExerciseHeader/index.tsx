'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/providers/I18n'
import { Logo } from '@/components/Logo/Logo'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl: string
}

export function ExerciseHeader({ exerciseTitle, backUrl }: ExerciseHeaderProps) {
  const t = useTranslations('courses')

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center justify-between px-5 flex-shrink-0 z-[100]">
      {/* Right: Back Button (in RTL) */}
      <Link
        href={backUrl}
        className="flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors text-2xl"
        aria-label={t('backToLesson')}
      >
        <ArrowRight className="w-6 h-6" />
      </Link>

      {/* Center: Exercise Title */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight">
        {exerciseTitle}
      </h1>

      {/* Left: Logo + Brand (in RTL) */}
      <div className="flex items-center gap-2">
        <span className="text-primary text-xl font-extrabold tracking-tight">Aguy</span>
        <Logo className="h-8 w-auto" />
      </div>
    </header>
  )
}
