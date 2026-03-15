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
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { BarChart3, Clock, GraduationCap, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

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
}

export function StudyContent({ lessonType = DEFAULT_LESSON_TYPE }: StudyContentProps) {
  const t = useTranslations('coursePage')
  const ts = useTranslations('study')
  const locale = useLocale()
  const [chapters, setChapters] = useState<ChapterWithLessons[]>([])
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const tabForLessonType: CourseTab =
    lessonType === 'practice' ? 'practice' : lessonType === 'exam' ? 'exams' : 'learn'
  const tabColor = TAB_COLORS[tabForLessonType]

  useEffect(() => {
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
  }, [locale])

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
      {/* Centered title area - clean background */}
      <div className="w-full py-6 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <ExamReminderBubble courseId={courseInfo?.courseId ?? ''} />
          <h1 className="text-3xl md:text-4xl font-black text-foreground mt-4 text-center">
            {sectionTitle}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 max-w-5xl">
        {filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map((lesson, idx) => (
              <LessonGridCard
                key={lesson.id}
                lesson={lesson}
                index={idx + 1}
                courseSlug={courseInfo?.courseSlug ?? ''}
                chapterSlug={lesson._chapterSlug}
                tabColor={tabColor}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground italic">
            <p className="text-lg">{ts('noTopicsAvailable')}</p>
          </div>
        )}

        {/* Footer actions with divider */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center justify-center gap-2 text-sm font-bold text-foreground bg-card border border-border px-6 py-3 rounded-full hover:bg-muted/50 transition-all">
              <BarChart3 className="w-4 h-4" />
              {t('statsAndPerformance')}
            </button>
            <button className="flex items-center justify-center gap-2 text-sm font-bold text-primary-foreground bg-primary px-6 py-3 rounded-full shadow-lg hover:opacity-90 transition-all">
              <GraduationCap className="w-4 h-4" />
              {t('upcomingExam')}
            </button>
            <button className="flex items-center justify-center gap-2 text-sm font-bold text-foreground bg-card border border-border px-6 py-3 rounded-full hover:bg-muted/50 transition-all">
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
      <span className="bg-primary text-white text-sm font-bold px-6 py-2 rounded-full">
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
}: {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
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

  const accentColor = tabColor?.stroke ?? 'hsl(var(--primary))'

  return (
    <div
      className="rounded-2xl overflow-hidden border border-border/40 shadow-sm transition-all active:scale-[0.98]"
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <SystemLink
        href={href}
        className={cn(
          'bg-card p-5',
          'flex flex-row-reverse items-center justify-between',
          'cursor-pointer',
        )}
      >
        <div className="flex flex-col text-end">
          <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wide">
            {tc('lesson')} {index}
          </span>
          <h3 className="text-lg font-bold text-card-foreground">{lesson.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
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
              className="text-sm font-bold fill-foreground"
            >
              {Math.round(progress)}%
            </text>
          </ProgressCircle>
        </div>
      </SystemLink>
    </div>
  )
}
