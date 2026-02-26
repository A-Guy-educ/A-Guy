'use client'

import { useEffect, useState } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { ChatInterface } from '@/ui/web/chat'
import { logger } from '@/infra/utils/logger'
import { Loader2 } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { AskPrimaryContent } from '../AskPrimaryContent'

interface AskContentProps {
  /** The conversation's contextKey — conversation must already exist in DB */
  conversationContextKey?: string
}

export function AskContent({ conversationContextKey }: AskContentProps) {
  const t = useTranslations('homepage.ask')
  const [courseId, setCourseId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadCourse() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      try {
        const response = await fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
        if (response.ok) {
          const data = await response.json()
          const courseIdFromData = data.courseId || ''
          if (courseIdFromData) {
            setCourseId(courseIdFromData)
          } else {
            const chapters = data.chapters || []
            if (chapters.length > 0) {
              const course = chapters[0].course
              const id = typeof course === 'string' ? course : course?.id
              if (id) setCourseId(id)
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error')
        logger.error({ err }, 'Failed to load course')
      } finally {
        setIsLoading(false)
      }
    }

    loadCourse()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin mr-2 text-muted-foreground" />
        <span className="text-muted-foreground">{t('loading')}</span>
      </div>
    )
  }

  if (!courseId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-muted-foreground py-12">{t('noCourse')}</div>
      </div>
    )
  }

  return (
    <ExerciseWorkspace
      exerciseTitle={t('pageTitle')}
      backUrl="/ask"
      primaryContent={<AskPrimaryContent />}
      chatContent={
        <ChatInterface
          courseId={courseId}
          contextKeyOverride={conversationContextKey}
          translationNamespace="homepage.ask"
        />
      }
    />
  )
}
