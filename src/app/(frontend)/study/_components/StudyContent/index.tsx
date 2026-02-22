'use client'

import { useEffect, useState } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import {
  DEFAULT_LESSON_TYPE,
  getEffectiveLessonType,
  type LessonType,
} from '@/server/constants/lesson-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { Chapter, Lesson } from '@/payload-types'
import { ChapterHeader } from '@/app/(frontend)/courses/_components/ChapterHeader'
import { LessonCard } from '@/app/(frontend)/courses/_components/LessonCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { logger } from '@/infra/utils/logger'

interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

interface StudyContentProps {
  lessonType?: LessonType
}

export function StudyContent({ lessonType = DEFAULT_LESSON_TYPE }: StudyContentProps) {
  const t = useTranslations('study')
  const [chapters, setChapters] = useState<ChapterWithLessons[]>([])
  const [courseSlug, setCourseSlug] = useState<string>('')
  const [coursePageAccessType, setCoursePageAccessType] = useState<string>('free')
  const [gatedDelayMs, setGatedDelayMs] = useState<number | undefined>(undefined)
  const [gatedWarningMs, setGatedWarningMs] = useState<number | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      try {
        // Load chapters with lessons for the selected course (by grade level)
        const chaptersResponse = await fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
        if (chaptersResponse.ok) {
          const data = await chaptersResponse.json()
          setChapters(data.chapters || [])
          setCourseSlug(data.courseSlug || '')
          setCoursePageAccessType(data.coursePageAccessType || 'free')
          setGatedDelayMs(data.gatedDelayMs)
          setGatedWarningMs(data.gatedWarningMs)
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error')
        logger.error({ err }, 'Failed to load chapters')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  const filteredChapters = chapters
    .map((chapter) => {
      const filteredLessons = (chapter.lessons ?? []).filter(
        (lesson) => getEffectiveLessonType(lesson.type) === lessonType,
      )
      return { ...chapter, lessons: filteredLessons }
    })
    .filter((chapter) => chapter.lessons.length > 0)

  return (
    <AccessGateProvider
      accessType={coursePageAccessType}
      courseSlug={courseSlug}
      gatedDelayMs={gatedDelayMs}
      gatedWarningMs={gatedWarningMs}
    >
      <div className="container mx-auto px-4 py-8">
        {filteredChapters.length > 0 ? (
          <div className="space-y-12">
            {filteredChapters.map((chapter) => {
              const chapterSlug = chapter.slug
              if (!chapterSlug) return null

              return (
                <section key={chapter.id}>
                  <ChapterHeader
                    chapterLabel={chapter.chapterLabel}
                    title={chapter.title}
                    description={chapter.description}
                  />
                  <div className="space-y-3">
                    {chapter.lessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        courseSlug={courseSlug}
                        chapterSlug={chapterSlug}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <EmptyState type="noLessons" />
        )}
      </div>
    </AccessGateProvider>
  )
}
