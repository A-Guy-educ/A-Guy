'use client'

import { useMemo } from 'react'
import type { Chapter, Lesson } from '@/payload-types'
import { getEffectiveLessonType } from '@/server/constants/lesson-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useProgressMap } from '@/client/hooks/useProgressMap'
import { StaggerGrid, StaggerItem } from '@/ui/web/components/motion'
import { CourseLessonCard } from '../CourseLessonCard'
import type { LessonProgress } from '../types'

interface LessonListTabProps {
  lessons: Lesson[]
  chapters: Chapter[]
  courseSlug: string
  tabColor?: { text: string; stroke: string }
  lessonProgressMap?: Record<string, LessonProgress>
  lessonType: 'learning' | 'practice'
}

export function LessonListTab({
  lessons,
  chapters,
  courseSlug,
  tabColor,
  lessonProgressMap = {},
  lessonType,
}: LessonListTabProps) {
  const t = useTranslations('coursePage')
  const filteredLessons = lessons.filter((l) => getEffectiveLessonType(l.type) === lessonType)

  const lessonIds = useMemo(() => filteredLessons.map((l) => l.id), [filteredLessons])
  const { progressMap, statusMap } = useProgressMap({ recordType: 'lesson', recordIds: lessonIds })

  if (filteredLessons.length === 0) {
    return null
  }

  const hasParentProgress = Object.keys(lessonProgressMap).length > 0

  const completedCount = hasParentProgress
    ? filteredLessons.filter((l) => (lessonProgressMap[l.id]?.percent ?? 0) >= 100).length
    : Object.values(statusMap).filter((s) => s === 'completed').length
  const inProgressCount = hasParentProgress
    ? filteredLessons.filter((l) => {
        const p = lessonProgressMap[l.id]?.percent ?? 0
        return p > 0 && p < 100
      }).length
    : Object.values(statusMap).filter((s) => s === 'in_progress').length
  const notStartedCount = filteredLessons.length - completedCount - inProgressCount

  return (
    <>
      <div className="flex gap-2 justify-center mb-6 flex-wrap">
        <span className="text-body-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{completedCount}</span> {t('statusCompleted')}
        </span>
        <span className="text-body-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{inProgressCount}</span> {t('statusInProgress')}
        </span>
        <span className="text-body-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
          <span style={{ color: tabColor?.stroke }}>{notStartedCount}</span> {t('statusNotStarted')}
        </span>
      </div>

      <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-content-gap">
        {filteredLessons.map((lesson, idx) => {
          const chapter = chapters.find((ch) => {
            const lessonChapterId =
              typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
            return ch.id === lessonChapterId
          })
          const chapterSlug = chapter?.slug ?? ''

          return (
            <StaggerItem key={lesson.id}>
              <CourseLessonCard
                lesson={lesson}
                index={idx + 1}
                courseSlug={courseSlug}
                chapterSlug={chapterSlug}
                tabColor={tabColor}
                progress={lessonProgressMap[lesson.id]?.percent ?? progressMap[lesson.id] ?? 0}
              />
            </StaggerItem>
          )
        })}
      </StaggerGrid>
    </>
  )
}
