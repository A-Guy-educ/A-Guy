'use client'

import { useEffect, useRef } from 'react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { Sparkles } from 'lucide-react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'

interface CompleteContentProps {
  backUrl: string
  lessonId: string
}

export function CompleteContent({ backUrl, lessonId }: CompleteContentProps) {
  const t = useTranslations('courses')
  const savedRef = useRef(false)

  // Save lesson completion on mount (idempotent fallback for direct navigation)
  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true
    const profile = getUserProfile()
    if (!profile?.gradeLevel) return
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        recordType: 'lesson',
        recordId: lessonId,
        completionPercentage: 100,
        status: 'completed',
        gradeLevel: profile.gradeLevel,
      }),
    }).catch(() => {
      /* silent – user may be anonymous */
    })
  }, [lessonId])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Progress value={100} className="h-1.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-3xl">
          <div className="space-y-8">
            <header className="text-center">
              <span className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-[10px] tracking-[0.2em] uppercase mb-5 border border-secondary/20">
                {t('exercisesPagerCompleted')}
              </span>
              <h1 className="text-4xl md:text-[42px] font-medium leading-tight text-foreground mb-3">
                {t('exercisesPagerCompletedTitle')}
              </h1>
              <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
            </header>

            <div className="bg-card rounded-3xl p-8 md:p-10 border border-border/60 shadow-xl shadow-muted/50 text-center">
              <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-secondary/10 border border-secondary/20">
                <Sparkles className="w-9 h-9 text-secondary" />
              </div>

              <h2 className="text-2xl font-medium mb-4 text-foreground">
                {t('exercisesPagerCompletedTitle')}
              </h2>
              <p className="text-muted-foreground mb-10 text-base leading-relaxed max-w-md mx-auto">
                {t('exercisesPagerCompletedDescription')}
              </p>

              <Button
                asChild
                size="lg"
                variant="secondary"
                className="w-full py-6 rounded-2xl text-lg shadow-lg shadow-secondary/20 hover:shadow-xl hover:shadow-secondary/30 transition-all duration-300"
              >
                <SystemLink href={backUrl}>
                  <Sparkles className="w-5 h-5 me-2" />
                  {t('exercisesPagerComplete')}
                </SystemLink>
              </Button>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                asChild
                variant="ghost"
                className="text-muted-foreground text-sm hover:text-foreground transition-colors duration-300 gap-1.5"
              >
                <SystemLink href={backUrl}>
                  <Sparkles className="w-4 h-4 me-2" />
                  {t('exercisesPagerBackToLesson')}
                </SystemLink>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
