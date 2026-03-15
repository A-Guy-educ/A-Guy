'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { Clock } from 'lucide-react'

interface CourseLessonCardProps {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
}

export function CourseLessonCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
  tabColor,
}: CourseLessonCardProps) {
  const t = useTranslations('coursePage')
  const tc = useTranslations('courses')

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
          <span
            className="text-[10px] font-bold mb-1 uppercase tracking-wide"
            style={{ color: accentColor }}
          >
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
