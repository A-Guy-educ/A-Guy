'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
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

  const accentColor = tabColor?.stroke ?? 'hsl(var(--primary))'

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
        'rounded-2xl overflow-hidden border border-border/40 shadow-sm transition-all',
        !isSoon && 'active:scale-[0.98]',
        isSoon && 'opacity-60',
      )}
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
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
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-card-foreground">{lesson.title}</h3>
            <ContentStatusBadge
              contentStatus={lesson.contentStatus}
              contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
            />
          </div>
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
