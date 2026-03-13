'use client'

import { useEffect, useState } from 'react'
import { Play, Sparkles } from 'lucide-react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import {
  DEFAULT_LESSON_TYPE,
  getEffectiveLessonType,
  type LessonType,
} from '@/server/constants/lesson-types'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { Chapter, Lesson } from '@/payload-types'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { cn } from '@/infra/utils/ui'
import { logger } from '@/infra/utils/logger'
import type { StudyData } from '@/server/repos/queries/study-data'

interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

interface CourseInfo {
  courseSlug: string
  courseId: string
  courseTitle: string
  courseLabel: string
  coursePageAccessType: string
  gatedDelayMs?: number
  gatedWarningMs?: number
}

interface StudyContentProps {
  lessonType?: LessonType
  /** When provided, skips the client-side API call entirely */
  prefetchedData?: StudyData | null
}

export function StudyContent({
  lessonType = DEFAULT_LESSON_TYPE,
  prefetchedData,
}: StudyContentProps) {
  const t = useTranslations('coursePage')
  const ts = useTranslations('study')
  const locale = useLocale()

  const hasPrefetched = prefetchedData !== undefined
  const [chapters, setChapters] = useState<ChapterWithLessons[]>(prefetchedData?.chapters ?? [])
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(
    prefetchedData
      ? {
          courseSlug: prefetchedData.courseSlug,
          courseId: prefetchedData.courseId,
          courseTitle: prefetchedData.courseTitle,
          courseLabel: prefetchedData.courseLabel,
          coursePageAccessType: prefetchedData.coursePageAccessType,
          gatedDelayMs: prefetchedData.gatedDelayMs,
          gatedWarningMs: prefetchedData.gatedWarningMs,
        }
      : null,
  )
  const [isLoading, setIsLoading] = useState(!hasPrefetched)

  // Only fetch client-side when no prefetched data (fallback for direct navigation)
  useEffect(() => {
    if (hasPrefetched) return

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
          setCourseInfo({
            courseSlug: data.courseSlug || '',
            courseId: data.courseId || '',
            courseTitle: data.courseTitle || '',
            courseLabel: data.courseLabel || '',
            coursePageAccessType: data.coursePageAccessType || 'free',
            gatedDelayMs: data.gatedDelayMs,
            gatedWarningMs: data.gatedWarningMs,
          })
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error')
        logger.error({ err }, 'Failed to load chapters')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [locale, hasPrefetched])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">{ts('loading')}</div>
      </div>
    )
  }

  const filteredLessons = chapters.flatMap((chapter) => {
    const chapterSlug = chapter.slug || ''
    return (chapter.lessons ?? [])
      .filter((lesson) => getEffectiveLessonType(lesson.type) === lessonType)
      .map((lesson) => ({ ...lesson, _chapterSlug: chapterSlug }))
  })

  const sectionTitle = courseInfo?.courseTitle || ts('studyTopics')

  return (
    <AccessGateProvider
      accessType={courseInfo?.coursePageAccessType ?? 'free'}
      courseSlug={courseInfo?.courseSlug ?? ''}
      gatedDelayMs={courseInfo?.gatedDelayMs}
      gatedWarningMs={courseInfo?.gatedWarningMs}
    >
      {/* Grade + Exam Reminder */}
      <GradeSection
        courseId={courseInfo?.courseId ?? ''}
        courseLabel={courseInfo?.courseLabel ?? ''}
      />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-10 max-w-5xl">
        <section className="mb-8 text-right px-2">
          <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
            {sectionTitle}
          </h2>
        </section>

        {filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map((lesson, idx) => (
              <LessonGridCard
                key={lesson.id}
                lesson={lesson}
                index={idx + 1}
                courseSlug={courseInfo?.courseSlug ?? ''}
                chapterSlug={lesson._chapterSlug}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground italic">
            <p className="text-lg">{ts('noTopicsAvailable')}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <button className="text-sm font-bold text-muted-foreground bg-card shadow-card px-8 py-3 rounded-full hover:bg-muted transition-all text-nowrap">
              {t('viewStats')}
            </button>
            <button className="text-sm font-bold text-primary-foreground bg-primary px-8 py-3 rounded-full shadow-lg hover:opacity-90 transition-all text-nowrap">
              {t('continueLastPoint')}
            </button>
          </div>
        </div>
      </main>
    </AccessGateProvider>
  )
}

/* ------------------------------------------------------------------ */
/* Grade section with exam reminder                                    */
/* ------------------------------------------------------------------ */

function GradeSection({ courseId, courseLabel }: { courseId: string; courseLabel: string }) {
  const t = useTranslations('coursePage')
  const { hasUpcomingExam, daysUntil } = useExamCountdown(courseId)

  return (
    <div className="w-full bg-card/50 py-4 border-b border-border">
      <div className="max-w-5xl mx-auto px-6 flex flex-col">
        <div className="text-center">
          <span className="text-sm md:text-base font-extrabold text-primary uppercase tracking-[0.3em]">
            {t('grade')} {courseLabel}
          </span>
        </div>
        {hasUpcomingExam && daysUntil !== null && (
          <div className="flex items-center justify-end gap-3 mt-3 animate-in fade-in">
            <div className="bg-card shadow-card border border-primary/10 rounded-2xl rounded-tr-none px-4 py-2">
              <p className="text-xs md:text-sm font-bold text-primary">
                {t('examReminder').replace('{days}', String(daysUntil))}
              </p>
            </div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground fill-current" />
            </div>
          </div>
        )}
      </div>
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
}: {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
}) {
  const t = useTranslations('coursePage')
  const tc = useTranslations('courses')

  if (!lesson.slug) return null

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
  // Placeholder progress — will be wired to UserProgress later
  const progress = 0
  const progressText =
    progress >= 100
      ? t('lessonCompleted')
      : progress > 0
        ? t('lessonsRemaining').replace('{count}', String(3))
        : t('notStarted')

  return (
    <SystemLink
      href={href}
      className={cn(
        'bg-card rounded-3xl p-6 shadow-card',
        'flex items-center justify-between',
        'border border-transparent hover:border-primary/20',
        'transition-all cursor-pointer active:scale-[0.98]',
      )}
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wide">
          {tc('lesson')} {index}
        </span>
        <h3 className="text-lg font-bold text-card-foreground">{lesson.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{progressText}</p>
      </div>

      <div className="relative shrink-0 w-14 h-14">
        <ProgressCircle percentage={progress} size={56} strokeWidth={3} />
        {progress === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-4 h-4 text-muted-foreground fill-current" />
          </div>
        )}
      </div>
    </SystemLink>
  )
}
