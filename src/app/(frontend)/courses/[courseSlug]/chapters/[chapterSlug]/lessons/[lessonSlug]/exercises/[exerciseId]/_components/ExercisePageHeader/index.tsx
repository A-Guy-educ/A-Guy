'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/providers/I18n'
import './index.scss'

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
    <div className="exercise-page-header">
      <div className="exercise-page-header__back">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`}>
            ← {t('backToLesson')}
          </Link>
        </Button>
      </div>

      <div className="exercise-page-header__content">
        <div className="exercise-page-header__meta">
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <h1 className="exercise-page-header__title">{title}</h1>
      </div>
    </div>
  )
}
