'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'

interface CourseLessonCardProps {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
  progress?: number
}

export function CourseLessonCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
  tabColor,
  progress = 0,
}: CourseLessonCardProps) {
  const t = useTranslations('coursePage')
  const tc = useTranslations('courses')

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`

  // Determine if lesson is "soon" (locked)
  const isSoon = lesson.contentStatus === 'soon'

  const progressText =
    progress >= 100 ? t('lessonCompleted') : progress > 0 ? t('statusInProgress') : t('notStarted')

  const accentColor = isSoon ? 'var(--border)' : (tabColor?.stroke ?? 'hsl(var(--primary))')

  const handleLessonClick = (e: React.MouseEvent) => {
    // If lesson is "Soon", show locked message and prevent navigation
    if (isSoon) {
      e.preventDefault()
      toast.info(tc('contentLocked'))
    }
  }

  return (
    <div
      className={cn(
        'group relative rounded-2xl bg-card border border-border/40 shadow-elevation-1',
        'transition-all duration-normal overflow-hidden will-change-transform',
        !isSoon && 'hover:border-border/50 active:scale-[0.98]',
        isSoon && 'opacity-60',
      )}
      style={{
        borderInlineStartWidth: '3px',
        borderInlineStartColor: accentColor,
      }}
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
          'p-5',
          'flex items-center justify-between gap-4',
          'transition-colors duration-normal',
          !isSoon && 'group-hover:bg-muted/30',
          isSoon ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <div className="flex flex-col text-start gap-1.5">
          <span
            className="text-label font-bold uppercase tracking-wide"
            style={{ color: accentColor }}
          >
            {tc('lesson')} {index}
          </span>
          <h3 className="text-heading-md font-bold text-card-foreground leading-snug">
            {lesson.title}
          </h3>
          <p className="text-body-sm text-muted-foreground flex items-center justify-start gap-1.5">
            {progress === 0 && <Clock className="w-3.5 h-3.5" />}
            {progressText}
          </p>
        </div>

        <div className="relative shrink-0 w-10 h-10">
          <ProgressCircle
            percentage={progress}
            size={40}
            strokeWidth={3}
            strokeColor={tabColor?.stroke}
          >
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dy=".3em"
              className="text-[10px] font-bold fill-foreground"
            >
              {Math.round(progress)}%
            </text>
          </ProgressCircle>
        </div>
      </SystemLink>
    </div>
  )
}
