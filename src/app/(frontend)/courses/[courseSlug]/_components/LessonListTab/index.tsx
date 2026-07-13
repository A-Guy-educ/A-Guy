'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Chapter, Lesson } from '@/payload-types'
import { useProgressMap } from '@/client/hooks/useProgressMap'
import { useTranslations } from '@/ui/web/providers/I18n'
import { toast } from 'sonner'
import type { LessonProgress } from '../types'
import { defaultExpandedChapterIds, groupLessonsForTimeline } from './lessons-grouping'
import { CourseLessonsHero } from './CourseLessonsHero'
import { CourseLessonsFilterBar, type LessonFilterMode } from './CourseLessonsFilterBar'
import { ChapterAccordion } from './ChapterAccordion'
import { applyLessonFilters } from './apply-filters'

interface LessonListTabProps {
  lessons: Lesson[]
  chapters: Chapter[]
  courseSlug: string
  /** Grade bucket of the course these lessons belong to — used to read progress for the right grade. */
  gradeLevel: string
  /** Accepted for backward compatibility — the redesign uses semantic tokens instead. */
  tabColor?: { text: string; stroke: string }
  lessonProgressMap?: Record<string, LessonProgress>
  lessonType: 'learning' | 'practice'
}

export function LessonListTab({
  lessons,
  chapters,
  courseSlug,
  gradeLevel,
  lessonProgressMap = {},
  lessonType,
}: LessonListTabProps) {
  const t = useTranslations('coursePage.lessonsPath')

  const lessonIds = useMemo(() => lessons.map((l) => l.id), [lessons])
  const { progressMap, statusMap } = useProgressMap({
    recordType: 'lesson',
    recordIds: lessonIds,
    gradeLevel,
  })

  const hasParentProgress = Object.keys(lessonProgressMap).length > 0

  const resolveProgress = useCallback(
    (lessonId: string): number => {
      if (hasParentProgress) return lessonProgressMap[lessonId]?.percent ?? 0
      return progressMap[lessonId] ?? 0
    },
    [hasParentProgress, lessonProgressMap, progressMap],
  )

  const resolveCompleted = useCallback(
    (lessonId: string): boolean => {
      if (hasParentProgress) return (lessonProgressMap[lessonId]?.percent ?? 0) >= 100
      return statusMap[lessonId] === 'completed'
    },
    [hasParentProgress, lessonProgressMap, statusMap],
  )

  const grouping = useMemo(
    () =>
      groupLessonsForTimeline({
        lessons,
        chapters,
        lessonType,
        lessonProgressMap,
        resolveProgress,
        resolveCompleted,
      }),
    [lessons, chapters, lessonType, lessonProgressMap, resolveProgress, resolveCompleted],
  )

  const [filterMode, setFilterMode] = useState<LessonFilterMode>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    defaultExpandedChapterIds(grouping),
  )

  const chapterRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const setChapterRef = useCallback(
    (chapterId: string) => (node: HTMLDivElement | null) => {
      if (node) chapterRefs.current.set(chapterId, node)
      else chapterRefs.current.delete(chapterId)
    },
    [],
  )

  const toggleChapter = useCallback((chapterId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }, [])

  const onFocusNext = useCallback(() => {
    const chapterId = grouping.activeChapterId
    if (!chapterId) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.add(chapterId)
      return next
    })
    requestAnimationFrame(() => {
      chapterRefs.current.get(chapterId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [grouping.activeChapterId])

  const onResetProgress = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!window.confirm(t('heroResetConfirm'))) return
    toast.info(t('heroResetDone'))
  }, [t])

  if (grouping.totalCount === 0) return null

  const visibleGroups = applyLessonFilters(grouping.groups, filterMode, grouping.activeChapterId)

  return (
    <div>
      <CourseLessonsHero
        overallPercent={grouping.overallPercent}
        totalCount={grouping.totalCount}
        completedCount={grouping.completedCount}
        activeEntry={grouping.activeEntry}
        allCompleted={grouping.allCompleted}
        onFocusNext={onFocusNext}
        onResetProgress={onResetProgress}
      />

      <CourseLessonsFilterBar
        value={filterMode}
        onChange={setFilterMode}
        hasActiveChapter={Boolean(grouping.activeChapterId)}
      />

      <div className="relative">
        <div className="lesson-timeline-track" aria-hidden>
          <div className="lesson-timeline-fill" style={{ height: `${grouping.overallPercent}%` }} />
        </div>

        <div className="space-y-6 relative z-10">
          {visibleGroups.map((group) => (
            <ChapterAccordion
              key={group.chapter.id}
              ref={setChapterRef(group.chapter.id)}
              group={group}
              visibleEntries={group.lessons}
              isExpanded={expandedIds.has(group.chapter.id)}
              onToggle={() => toggleChapter(group.chapter.id)}
              courseSlug={courseSlug}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
