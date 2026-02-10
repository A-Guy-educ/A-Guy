'use client'

import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { logger } from '@/infra/utils/logger'
import { ChatInterface } from '@/ui/web/chat'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export function AskContent() {
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
        // Fetch course by grade level
        const response = await fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
        if (response.ok) {
          const data = await response.json()
          const chapters = data.chapters || []
          if (chapters.length > 0) {
            const course = chapters[0].course
            const id = typeof course === 'string' ? course : course?.id
            if (id) {
              setCourseId(id)
            } else {
              logger.error('Course ID not found in response')
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-muted-foreground" />
          <span className="text-muted-foreground">{t('loading')}</span>
        </div>
      </div>
    )
  }

  if (!courseId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground py-12">{t('noCourse')}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 h-[calc(100vh-200px)]">
      <ChatInterface
        courseId={courseId}
        translationNamespace="homepage.ask"
      />
    </div>
  )
}
