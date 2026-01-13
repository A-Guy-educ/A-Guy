'use client'

import { useEffect, useState } from 'react'
import { getUserProfile } from '@/lib/localStorage/userProfile'
import { useTranslations } from '@/providers/I18n'
import type { Chapter, Lesson } from '@/payload-types'
import { ChapterHeader } from '@/app/(frontend)/courses/_components/ChapterHeader'
import { LessonCard } from '@/app/(frontend)/courses/_components/LessonCard'
import { EmptyState } from '@/app/(frontend)/courses/_components/EmptyState'

interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

export function StudyContent() {
  const t = useTranslations('study')
  const [chapters, setChapters] = useState<ChapterWithLessons[]>([])
  const [courseSlug, setCourseSlug] = useState<string>('')
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
        }
      } catch (error) {
        console.error('Failed to load chapters:', error)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('studyTopics')}</h1>
      {chapters.length > 0 ? (
        <div className="space-y-12">
          {chapters.map((chapter) => {
            const chapterSlug = chapter.slug
            if (!chapterSlug) return null

            return (
              <section key={chapter.id}>
                <ChapterHeader
                  chapterLabel={chapter.chapterLabel}
                  title={chapter.title}
                  description={chapter.description}
                />
                {chapter.lessons && chapter.lessons.length > 0 ? (
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
                ) : (
                  <EmptyState type="noLessons" />
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-12">{t('noTopicsAvailable')}</div>
      )}
    </div>
  )
}
