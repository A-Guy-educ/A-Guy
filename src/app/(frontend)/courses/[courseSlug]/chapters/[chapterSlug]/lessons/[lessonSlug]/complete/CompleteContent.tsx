'use client'

import { useEffect, useRef } from 'react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { Sparkles, Trophy } from 'lucide-react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { motion } from 'framer-motion'
import { Confetti } from '@/ui/web/components/confetti'

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
      <Confetti active={true} />
      <Progress value={100} className="h-0.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-12 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-8"
          >
            <header className="text-center relative">
              {/* Decorative background circles */}
              <div className="absolute inset-0 -top-10 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="w-72 h-72 rounded-full bg-gradient-to-br from-secondary/10 to-primary/5 blur-3xl" />
                <div className="absolute w-48 h-48 rounded-full bg-gradient-to-tr from-primary/10 to-secondary/5 blur-2xl -translate-x-20 translate-y-10" />
                <div className="absolute w-32 h-32 rounded-full bg-gradient-to-bl from-secondary/8 to-primary/3 blur-xl translate-x-32 -translate-y-8" />
              </div>

              <span className="relative inline-block px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-secondary/20">
                {t('exercisesPagerCompleted')}
              </span>
              <h1 className="relative text-display-lg md:text-display-xl font-bold leading-tight text-foreground mb-3">
                {t('exercisesPagerCompletedTitle')}
              </h1>
              <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
            </header>

            <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center relative overflow-hidden">
              {/* Decorative corner accents */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-secondary/5 to-transparent rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/5 to-transparent rounded-tr-full" />
              <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-secondary/3 to-transparent rounded-br-full" />

              <div className="relative">
                <div className="w-24 h-24 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-secondary/10 border border-secondary/20">
                  <Trophy className="w-11 h-11 text-secondary" />
                </div>

                <h2 className="text-display-xl font-bold mb-4 text-foreground">
                  {t('exercisesPagerCompletedTitle')}
                </h2>
                <p className="text-muted-foreground mb-10 text-body-lg leading-relaxed max-w-md mx-auto">
                  {t('exercisesPagerCompletedDescription')}
                </p>

                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="w-full py-section-sm rounded-2xl text-body-lg shadow-card shadow-secondary/20 hover:shadow-card-hover hover:shadow-secondary/30 transition-all duration-slow"
                >
                  <SystemLink href={backUrl}>
                    <Sparkles className="w-5 h-5 me-2" />
                    {t('exercisesPagerComplete')}
                  </SystemLink>
                </Button>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                asChild
                variant="ghost"
                className="text-muted-foreground text-body-sm hover:text-foreground transition-colors duration-slow gap-2"
              >
                <SystemLink href={backUrl}>
                  <Sparkles className="w-4 h-4 me-2" />
                  {t('exercisesPagerBackToLesson')}
                </SystemLink>
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
