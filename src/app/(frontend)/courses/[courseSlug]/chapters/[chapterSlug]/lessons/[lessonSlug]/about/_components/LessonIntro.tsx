'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'
import type { Lesson, Media as MediaType } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'

interface LessonIntroProps {
  lesson: Lesson
  lessonUrl: string
}

export function LessonIntro({ lesson, lessonUrl }: LessonIntroProps) {
  const t = useTranslations('courses')

  const introMedia =
    lesson.introMedia && typeof lesson.introMedia !== 'string'
      ? (lesson.introMedia as MediaType)
      : null

  const description = lesson.introDescription || lesson.description

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-8 text-center">
        {introMedia?.url && (
          <div className="mx-auto max-h-80 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMediaUrl(introMedia.url)}
              alt={introMedia.alt || ''}
              className="mx-auto max-h-80 w-auto object-contain"
            />
          </div>
        )}

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">{lesson.title}</h1>
          {description && (
            <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>

        <Button size="lg" asChild className="text-lg px-10 py-6">
          <SystemLink href={lessonUrl}>{t('startLesson')}</SystemLink>
        </Button>
      </div>
    </div>
  )
}
