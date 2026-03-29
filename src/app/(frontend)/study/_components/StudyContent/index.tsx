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
import { Skeleton, SkeletonCard } from '@/ui/web/components/skeleton'
import { AccessGateProvider } from '@/ui/web/auth/AccessGateProvider'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { BarChart3, BookOpen, Clock, FileText, GraduationCap, PlayCircle, Sparkles, Target, Trophy } from 'lucide-react'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { motion } from 'framer-motion'
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

interface FilteredLesson extends Lesson {
  _chapterSlug: string
  _chapterTitle: string
  _chapterLabel: string | null | undefined
}

interface ChapterGroup {
  chapterSlug: string
  chapterTitle: string
  chapterLabel: string | null | undefined
  lessons: FilteredLesson[]
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
          .map((lesson) => ({
            ...lesson,
            _chapterSlug: chapterSlug,
            _chapterTitle: chapter.title,
            _chapterLabel: chapter.chapterLabel,
          }))
      }),
    [chapters, lessonType],
  )

  /** Group lessons by chapter for section-based rendering */
  const chapterGroups = useMemo(() => {
    const groups: ChapterGroup[] = []
    const groupMap = new Map<string, ChapterGroup>()

    for (const lesson of filteredLessons) {
      const key = lesson._chapterSlug
      const existing = groupMap.get(key)
      if (existing) {
        existing.lessons.push(lesson)
      } else {
        const group: ChapterGroup = {
          chapterSlug: lesson._chapterSlug,
          chapterTitle: lesson._chapterTitle,
          chapterLabel: lesson._chapterLabel,
          lessons: [lesson],
        }
        groupMap.set(key, group)
        groups.push(group)
      }
    }

    return groups
  }, [filteredLessons])

  const lessonIds = useMemo(() => filteredLessons.map((l) => l.id), [filteredLessons])
  const { progressMap } = useProgressMap({ recordType: 'lesson', recordIds: lessonIds })

  /** Compute overall progress across all filtered lessons */
  const overallProgress = useMemo(() => {
    if (filteredLessons.length === 0) return 0
    const totalProgress = filteredLessons.reduce(
      (sum, lesson) => sum + (progressMap[lesson.id] ?? 0),
      0,
    )
    return Math.round(totalProgress / filteredLessons.length)
  }, [filteredLessons, progressMap])

  /** Find the in-progress lesson with the highest progress for "continue" card */
  const continueLesson = useMemo(() => {
    let best: { title: string; progress: number; href: string } | null = null
    for (const lesson of filteredLessons) {
      const p = progressMap[lesson.id] ?? 0
      if (p > 0 && p < 100) {
        if (!best || p > best.progress) {
          const href = `/courses/${courseInfo?.courseSlug ?? ''}/chapters/${lesson._chapterSlug}/lessons/${lesson.slug}`
          best = { title: lesson.title, progress: Math.round(p), href }
        }
      }
    }
    return best
  }, [filteredLessons, progressMap, courseInfo?.courseSlug])

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-section-sm max-w-5xl">
        <div className="max-w-5xl mx-auto text-center mb-8">
          <Skeleton className="h-7 w-24 rounded-full mx-auto mb-3" />
          <Skeleton className="h-10 w-72 mx-auto mb-4" />
          <div className="max-w-sm mx-auto space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-content-gap-lg">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  const sectionTitle = courseInfo?.courseTitle || ts('studyTopics')
  const hasMultipleChapters = chapterGroups.length > 1

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
      {/* Course context header */}
      <div className="w-full pt-5 pb-1 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <ExamReminderBubble courseId={courseInfo?.courseId ?? ''} />

          <h1 className="text-heading-lg font-bold text-foreground mt-1">
            {sectionTitle}
          </h1>

          {/* Overall progress bar */}
          {filteredLessons.length > 0 && overallProgress > 0 && (
            <div className="mt-3 max-w-xs mx-auto">
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: tabColor.stroke }}
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-body-xs font-bold text-muted-foreground">
                  {overallProgress}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-4 max-w-3xl">
        {continueLesson && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-content-gap-lg"
          >
            <div className="bg-gradient-to-r from-primary/10 via-card to-accent/5 border border-primary/20 rounded-2xl p-card-padding flex items-center gap-content-gap">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <PlayCircle className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                  {ts('continueLearning')}
                </p>
                <h3 className="text-heading-md font-bold truncate">{continueLesson.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={continueLesson.progress} className="h-1.5 flex-1 max-w-32" />
                  <span className="text-body-xs text-muted-foreground">{continueLesson.progress}%</span>
                </div>
              </div>
              <Button asChild>
                <SystemLink href={continueLesson.href}>{ts('continue')}</SystemLink>
              </Button>
            </div>
          </motion.div>
        )}

        {filteredLessons.length > 0 ? (
          <div className="space-y-8">
            {chapterGroups.map((group, groupIdx) => {
              const startIndex = chapterGroups
                .slice(0, groupIdx)
                .reduce((sum, g) => sum + g.lessons.length, 0)

              return (
                <section key={group.chapterSlug}>
                  {hasMultipleChapters && (
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-0.5 h-5 rounded-full shrink-0"
                        style={{ backgroundColor: tabColor.stroke }}
                      />
                      <h2 className="text-heading-sm font-semibold text-muted-foreground">
                        {group.chapterLabel && <span>{group.chapterLabel} </span>}
                        {group.chapterTitle}
                      </h2>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {group.lessons.map((lesson, idx) => (
                      <motion.div
                        key={lesson.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: (startIndex + idx) * 0.04,
                          ease: 'easeOut',
                        }}
                      >
                        <LessonGridCard
                          lesson={lesson}
                          index={startIndex + idx + 1}
                          courseSlug={courseInfo?.courseSlug ?? ''}
                          chapterSlug={lesson._chapterSlug}
                          tabColor={tabColor}
                          progress={progressMap[lesson.id] ?? 0}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground italic">
            <p className="text-body-lg">{ts('noTopicsAvailable')}</p>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 pt-5 border-t border-border/30">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <SystemLink
              href="/stats"
              className="group inline-flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-body-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              {t('statsAndPerformance')}
            </SystemLink>
            <SystemLink
              href="/study-plan"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-body-sm font-medium text-primary-foreground transition-all hover:opacity-90"
            >
              <GraduationCap className="w-4 h-4" />
              {t('upcomingExam')}
            </SystemLink>
            <button className="group inline-flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-body-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-all">
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

  // Pick icon based on lesson type
  const TypeIcon = lesson.type === 'practice' ? Target : lesson.type === 'exam' ? Trophy : BookOpen
  const hasFiles = (lesson.contentFiles?.length ?? 0) > 0

  return (
    <div
      className={cn(
        'relative group rounded-xl bg-card border border-border/30 transition-all duration-normal',
        !isSoon && 'hover:border-border/50',
        isSoon && 'opacity-50',
      )}
      style={{
        borderInlineStartWidth: '3px',
        borderInlineStartColor: isSoon ? 'var(--border)' : accentColor,
      }}
    >
      <ContentStatusBadge
        contentStatus={lesson.contentStatus}
        contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
        contentStatusLabel={lesson.contentStatusLabel ?? undefined}
        className="absolute -top-2.5 end-3 z-10"
      />
      <SystemLink
        href={isSoon ? '#' : href}
        onClick={handleLessonClick}
        className={cn(
          'p-5 flex items-center gap-4',
          isSoon ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        {/* Lesson icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accentColor.replace(')', ' / 0.15)')}` }}
        >
          <TypeIcon className="w-5 h-5" style={{ color: accentColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-body-xs font-medium text-muted-foreground">
              {tc('lesson')} {index}
            </span>
            {hasFiles && (
              <FileText className="w-3 h-3 text-muted-foreground/50" />
            )}
          </div>
          <h3 className="text-body-lg font-semibold text-card-foreground truncate">{lesson.title}</h3>
          {lesson.description && (
            <p className="text-body-xs text-muted-foreground mt-1 line-clamp-1 [&_p]:inline">
              {lesson.description.replace(/<[^>]*>/g, '')}
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {progress > 0 ? (
            <>
              <span className="text-body-sm font-semibold" style={{ color: accentColor }}>
                {Math.round(progress)}%
              </span>
              <div className="w-14 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: accentColor }} />
              </div>
            </>
          ) : (
            <span className="text-body-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {progressText}
            </span>
          )}
        </div>
      </SystemLink>
    </div>
  )
}
