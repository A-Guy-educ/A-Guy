'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { BookOpen, Clock, Target, Trophy } from 'lucide-react'
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
  const tc = useTranslations('courses')

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
  const isSoon = lesson.contentStatus === 'soon'
  const accentColor = isSoon ? 'var(--border)' : (tabColor?.stroke ?? 'hsl(var(--primary))')

  const t = useTranslations('coursePage')
  const progressText =
    progress >= 100 ? t('lessonCompleted') : progress > 0 ? t('statusInProgress') : t('notStarted')

  const handleLessonClick = (e: React.MouseEvent) => {
    if (isSoon) {
      e.preventDefault()
      toast.info(tc('contentLocked'))
    }
  }

  const _TypeIcon = lesson.type === 'practice' ? Target : lesson.type === 'exam' ? Trophy : BookOpen
  const _hasFiles = (lesson.contentFiles?.length ?? 0) > 0

  return (
    <div
      className={cn(
        'relative group rounded-xl bg-card border border-border/30 transition-all duration-normal will-change-transform',
        !isSoon && 'hover:border-border/50 active:scale-[0.98]',
        isSoon && 'opacity-50',
      )}
      style={{
        borderTopWidth: '3px',
        borderTopColor: accentColor,
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
          'p-5 flex items-center justify-between gap-4',
          isSoon ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <div className="flex flex-col text-start gap-1.5 min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: accentColor }}
          >
            {tc('lesson')} {index}
          </span>
          <h3 className="text-body-lg font-bold text-card-foreground leading-snug">
            {lesson.title}
          </h3>
          <p className="text-body-xs text-muted-foreground flex items-center gap-1.5">
            {progress === 0 && <Clock className="w-3.5 h-3.5" />}
            {progressText}
          </p>
        </div>

        <div className="shrink-0 w-14 h-14">
          <ProgressCircle percentage={progress} size={56} strokeWidth={3} strokeColor={accentColor}>
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
