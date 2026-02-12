'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Lesson, Media as MediaType } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { Media } from '@/ui/web/media'

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
        {introMedia && (
          <div className="relative mx-auto h-80 w-full overflow-hidden rounded-xl">
            <Media resource={introMedia} fill imgClassName="object-contain" />
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
