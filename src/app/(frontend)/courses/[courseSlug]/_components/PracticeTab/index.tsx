'use client'

import type { Chapter, Lesson } from '@/payload-types'
import { getEffectiveLessonType } from '@/server/constants/lesson-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { CourseLessonCard } from '../CourseLessonCard'

interface PracticeTabProps {
  lessons: Lesson[]
  chapters: Chapter[]
  courseSlug: string
  tabColor?: { text: string; stroke: string }
}

export function PracticeTab({ lessons, chapters, courseSlug, tabColor }: PracticeTabProps) {
  const t = useTranslations('coursePage')
  const practiceLessons = lessons.filter((l) => getEffectiveLessonType(l.type) === 'practice')

  if (practiceLessons.length === 0) {
    return null
  }

  // Placeholder — will reflect real UserProgress when wired
  const completedCount = 0
  const inProgressCount = 0
  const notStartedCount = practiceLessons.length

  return (
    <>
      <div className="flex gap-2 justify-center mb-6 flex-wrap">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{completedCount}</span> {t('statusCompleted')}
        </span>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{inProgressCount}</span> {t('statusInProgress')}
        </span>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{notStartedCount}</span> {t('statusNotStarted')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {practiceLessons.map((lesson, idx) => {
          const chapter = chapters.find((ch) => {
            const lessonChapterId =
              typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
            return ch.id === lessonChapterId
          })
          const chapterSlug = chapter?.slug ?? ''

          return (
            <CourseLessonCard
              key={lesson.id}
              lesson={lesson}
              index={idx + 1}
              courseSlug={courseSlug}
              chapterSlug={chapterSlug}
              tabColor={tabColor}
            />
          )
        })}
      </div>
    </>
  )
}
