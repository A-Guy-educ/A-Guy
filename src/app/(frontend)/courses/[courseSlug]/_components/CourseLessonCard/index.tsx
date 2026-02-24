'use client'

import { Play } from 'lucide-react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'

interface CourseLessonCardProps {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
}

export function CourseLessonCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
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
