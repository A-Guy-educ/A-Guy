'use client'

import { getEffectiveLessonType } from '@/server/constants/lesson-types'
import type { Chapter, Lesson } from '@/payload-types'
import { CourseLessonCard } from '../CourseLessonCard'

interface PracticeTabProps {
  lessons: Lesson[]
  chapters: Chapter[]
  courseSlug: string
}

export function PracticeTab({ lessons, chapters, courseSlug }: PracticeTabProps) {
  const practiceLessons = lessons.filter((l) => getEffectiveLessonType(l.type) === 'practice')

  if (practiceLessons.length === 0) {
    return null
  }

  return (
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
          />
        )
      })}
    </div>
  )
}
