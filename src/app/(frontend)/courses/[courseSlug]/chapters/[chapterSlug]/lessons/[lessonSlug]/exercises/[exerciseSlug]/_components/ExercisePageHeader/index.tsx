'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { useTranslations } from '@/ui/web/providers/I18n'

interface ExercisePageHeaderProps {
  title: string
  questionType: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
}

export function ExercisePageHeader({
  title,
  questionType,
  courseSlug,
  chapterSlug,
  lessonSlug,
}: ExercisePageHeaderProps) {
  const t = useTranslations('courses')

  const getQuestionTypeBadge = (type: string) => {
    const badges = {
      mcq: { label: t('mcqBadge'), variant: 'default' as const },
      true_false: { label: t('trueFalseBadge'), variant: 'secondary' as const },
      free_response: { label: t('freeResponseBadge'), variant: 'outline' as const },
    }
    return badges[type as keyof typeof badges] || { label: type, variant: 'default' as const }
  }

  const badge = getQuestionTypeBadge(questionType)

  return (
    <div className="mb-8">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <SystemLink href={`/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`}>
            ← {t('backToLesson')}
          </SystemLink>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <h1 className="text-4xl md:text-3xl font-bold leading-tight text-foreground m-0">
          {title}
        </h1>
      </div>
    </div>
  )
}
