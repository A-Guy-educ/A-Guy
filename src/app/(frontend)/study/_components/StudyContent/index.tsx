'use client'

import {
  TAB_COLORS,
  type CourseTab,
} from '@/app/(frontend)/courses/[courseSlug]/_components/CourseTabs'
import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { logger } from '@/infra/utils/logger'
import { cn } from '@/infra/utils/ui'
import type { Chapter, Lesson } from '@/payload-types'
import {
  DEFAULT_LESSON_TYPE,
  getEffectiveLessonType,
  type LessonType,
} from '@/server/constants/lesson-types'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { BarChart3, Clock, GraduationCap, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useMemo, useState } from 'react'
import { useProgressMap } from '@/client/hooks/useProgressMap'

interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

interface CourseInfo {
  courseSlug: string
  courseId: string
  courseTitle: string
  courseLabel: string
  coursePageAccessType: string
  courseAccessType: string
  gatedDelayMs?: number
  gatedWarningMs?: number
}

interface PrefetchedData {
  chapters: ChapterWithLessons[]
  courseSlug: string
  courseId: string
  courseTitle: string
  courseLabel: string
  coursePageAccessType: string
  courseAccessType: string
  gatedDelayMs?: number
  gatedWarningMs?: number
}

interface StudyContentProps {
  lessonType?: LessonType
  /** Server-side prefetched data — skips client-side API fetch when provided */
  prefetchedData?: PrefetchedData | null
}

export function StudyContent({
  lessonType = DEFAULT_LESSON_TYPE,
  prefetchedData,
}: StudyContentProps) {
  const t = useTranslations('coursePage')
  const ts = useTranslations('study')
  const locale = useLocale()
  const [chapters, setChapters] = useState<ChapterWithLessons[]>(prefetchedData?.chapters ?? [])
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(
    prefetchedData
      ? {
          courseSlug: prefetchedData.courseSlug,
          courseId: prefetchedData.courseId,
          courseTitle: prefetchedData.courseTitle,
          courseLabel: prefetchedData.courseLabel,
          coursePageAccessType: prefetchedData.coursePageAccessType,
          courseAccessType: prefetchedData.courseAccessType,
          gatedDelayMs: prefetchedData.gatedDelayMs,
          gatedWarningMs: prefetchedData.gatedWarningMs,
        }
      : null,
  )
  const [isLoading, setIsLoading] = useState(!prefetchedData)
  const [requiresEntitlement, setRequiresEntitlement] = useState<boolean | undefined>(undefined)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined)

  const tabForLessonType: CourseTab =
    lessonType === 'practice' ? 'practice' : lessonType === 'exam' ? 'exams' : 'learn'
  const tabColor = TAB_COLORS[tabForLessonType]

  useEffect(() => {
    // Skip fetch if server already prefetched the data
    if (prefetchedData) {
      // Still check entitlements client-side (needs auth cookies)
      const info = prefetchedData
      const isPaid = info.coursePageAccessType === 'paid' || info.courseAccessType === 'paid'
      if (isPaid && info.courseId) {
        fetch(`/api/entitlements/check?courseId=${info.courseId}`)
          .then(async (entRes) => {
            if (entRes.ok) {
              const entData = await entRes.json()
              setRequiresEntitlement(!entData.hasAccess)
              setIsAuthenticated(true)
            } else if (entRes.status === 401) {
              setRequiresEntitlement(true)
              setIsAuthenticated(false)
            }
          })
          .catch(() => {})
      }
      return
    }

    // Fallback: client-side fetch (no grade cookie available)
    async function loadData() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      try {
        const res = await fetch(
          `/api/chapters/by-grade?grade=${profile.gradeLevel}&locale=${locale}`,
        )
        if (res.ok) {
          const data = await res.json()
          setChapters(data.chapters || [])
          const info = {
            courseSlug: data.courseSlug || '',
            courseId: data.courseId || '',
            courseTitle: data.courseTitle || '',
            courseLabel: data.courseLabel || '',
            coursePageAccessType: data.coursePageAccessType || 'free',
            courseAccessType: data.courseAccessType || 'free',
            gatedDelayMs: data.gatedDelayMs,
            gatedWarningMs: data.gatedWarningMs,
          }
          setCourseInfo(info)

          const isPaid = info.coursePageAccessType === 'paid' || info.courseAccessType === 'paid'
          if (isPaid && info.courseId) {
            fetch(`/api/entitlements/check?courseId=${info.courseId}`)
              .then(async (entRes) => {
                if (entRes.ok) {
                  const entData = await entRes.json()
                  setRequiresEntitlement(!entData.hasAccess)
                  setIsAuthenticated(true)
                } else if (entRes.status === 401) {
                  setRequiresEntitlement(true)
                  setIsAuthenticated(false)
                }
              })
              .catch(() => {})
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error')
        logger.error({ err }, 'Failed to load chapters')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [locale, prefetchedData])

  const filteredLessons = useMemo(
    () =>
      chapters.flatMap((chapter) => {
        const chapterSlug = chapter.slug || ''
        return (chapter.lessons ?? [])
          .filter((lesson) => getEffectiveLessonType(lesson.type) === lessonType)
          .map((lesson) => ({ ...lesson, _chapterSlug: chapterSlug }))
      }),
    [chapters, lessonType],
  )

  const lessonIds = useMemo(() => filteredLessons.map((l) => l.id), [filteredLessons])
  const { progressMap } = useProgressMap({ recordType: 'lesson', recordIds: lessonIds })

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-section-md">
        <div className="text-center text-muted-foreground">{ts('loading')}</div>
      </div>
    )
  }

  const sectionTitle = courseInfo?.courseTitle || ts('studyTopics')

  return (
    <AccessGateProvider
      accessType={
        courseInfo?.coursePageAccessType === 'paid' || courseInfo?.courseAccessType === 'paid'
          ? 'paid'
          : (courseInfo?.coursePageAccessType ?? 'free')
      }
      courseSlug={courseInfo?.courseSlug ?? ''}
      gatedDelayMs={courseInfo?.gatedDelayMs}
      gatedWarningMs={courseInfo?.gatedWarningMs}
      requiresEntitlement={requiresEntitlement}
      isAuthenticated={isAuthenticated}
    >
      {/* Centered title area - clean background */}
      <div className="w-full py-section-sm px-6">
        <div className="max-w-5xl mx-auto text-center">
          <ExamReminderBubble courseId={courseInfo?.courseId ?? ''} />
          <h1 className="text-display-sm md:text-display-md font-black text-foreground mt-4 text-center">
            {sectionTitle}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-section-sm max-w-5xl">
        {filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-content-gap-lg">
            {filteredLessons.map((lesson, idx) => (
              <LessonGridCard
                key={lesson.id}
                lesson={lesson}
                index={idx + 1}
                courseSlug={courseInfo?.courseSlug ?? ''}
                chapterSlug={lesson._chapterSlug}
                tabColor={tabColor}
                progress={progressMap[lesson.id] ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground italic">
            <p className="text-body-lg">{ts('noTopicsAvailable')}</p>
          </div>
        )}

        {/* Footer actions with divider */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-content-gap">
            <SystemLink
              href="/stats"
              className="flex items-center justify-center gap-content-gap-xs text-body-sm font-bold text-foreground bg-card border border-border px-6 py-3 rounded-full hover:bg-muted/50 transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              {t('statsAndPerformance')}
            </SystemLink>
            <SystemLink
              href="/study-plan"
              className="flex items-center justify-center gap-content-gap-xs text-body-sm font-bold text-primary-foreground bg-primary px-6 py-3 rounded-full shadow-card hover:opacity-90 transition-all"
            >
              <GraduationCap className="w-4 h-4" />
              {t('upcomingExam')}
            </SystemLink>
            <button className="flex items-center justify-center gap-content-gap-xs text-body-sm font-bold text-foreground bg-card border border-border px-6 py-3 rounded-full hover:bg-muted/50 transition-all">
              <Sparkles className="w-4 h-4" />
              {t('bagrutTransition')}
            </button>
          </div>
        </div>
      </main>
    </AccessGateProvider>
  )
}

/* ------------------------------------------------------------------ */
/* Exam reminder bubble                                                */
/* ------------------------------------------------------------------ */

function ExamReminderBubble({ courseId }: { courseId: string }) {
  const t = useTranslations('coursePage')
  // Check both the actual courseId and 'default-course' (used by study-plan page)
  const courseExam = useExamCountdown(courseId)
  const fallbackExam = useExamCountdown('default-course')
  const { hasUpcomingExam, daysUntil } = courseExam.hasUpcomingExam ? courseExam : fallbackExam

  if (!hasUpcomingExam || daysUntil === null) return null

  const message = t('examReminder').replace('{days}', String(daysUntil))

  return (
    <div className="flex justify-center mt-4 animate-in fade-in">
      <span className="bg-primary text-white text-body-sm font-bold px-6 py-2 rounded-full">
        {message}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Lesson grid card matching the HTML design                           */
/* ------------------------------------------------------------------ */

function LessonGridCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
  tabColor,
  progress: progressProp,
}: {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
  progress?: number
}) {
  const t = useTranslations('coursePage')
  const tc = useTranslations('courses')

  if (!lesson.slug) return null

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
  const isSoon = lesson.contentStatus === 'soon'
  const progress = progressProp ?? 0
  const progressText =
    progress >= 100 ? t('lessonCompleted') : progress > 0 ? t('statusInProgress') : t('notStarted')

  const accentColor = tabColor?.stroke ?? 'hsl(var(--primary))'

  const handleLessonClick = (e: React.MouseEvent) => {
    if (isSoon) {
      e.preventDefault()
      toast.info(tc('contentLocked'))
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-visible border border-border/40 shadow-elevation-1 transition-all',
        !isSoon && 'active:scale-[0.98]',
        isSoon && 'opacity-60',
      )}
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <ContentStatusBadge
        contentStatus={lesson.contentStatus}
        contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
        contentStatusLabel={lesson.contentStatusLabel ?? undefined}
        className="absolute -top-3 right-4 z-10"
      />
      <SystemLink
        href={isSoon ? '#' : href}
        onClick={handleLessonClick}
        className={cn(
          'bg-card p-5',
          'flex flex-row-reverse items-center justify-between',
          isSoon ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <div className="flex flex-col text-end">
          <span
            className="text-[10px] font-bold mb-1 uppercase tracking-wide"
            style={{ color: accentColor }}
          >
            {tc('lesson')} {index}
          </span>
          <h3 className="text-body-lg font-bold text-card-foreground">{lesson.title}</h3>
          <p className="text-body-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
            {progress === 0 && <Clock className="w-3 h-3" />}
            {progressText}
          </p>
        </div>

        <div className="relative shrink-0 w-14 h-14">
          <ProgressCircle
            percentage={progress}
            size={56}
            strokeWidth={3}
            strokeColor={tabColor?.stroke}
          >
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dy=".3em"
              className="text-body-sm font-bold fill-foreground"
            >
              {Math.round(progress)}%
            </text>
          </ProgressCircle>
        </div>
      </SystemLink>
    </div>
  )
}
