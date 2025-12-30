'use client'

import Link from 'next/link'
import type { Exercise } from '@/payload-types'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/providers/I18n'

interface ExerciseCardProps {
  exercise: Exercise
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  index: number
}

export function ExerciseCard({
  exercise,
  courseSlug,
  chapterSlug,
  lessonSlug,
  index,
}: ExerciseCardProps) {
  const t = useTranslations('courses')

  const getQuestionTypeBadge = (questionType: string) => {
    const badges = {
      mcq: { label: t('mcqBadge'), variant: 'default' as const },
      true_false: { label: t('trueFalseBadge'), variant: 'secondary' as const },
      free_response: { label: t('freeResponseBadge'), variant: 'outline' as const },
    }
    return (
      badges[questionType as keyof typeof badges] || {
        label: questionType,
        variant: 'default' as const,
      }
    )
  }

  const badge = getQuestionTypeBadge(exercise.questionType)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('exercise')} {index + 1}
          </span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <CardTitle className="text-xl">{exercise.title}</CardTitle>
        {exercise.contentJson &&
          typeof exercise.contentJson === 'object' &&
          'stem' in exercise.contentJson &&
          Array.isArray(exercise.contentJson.stem) &&
          exercise.contentJson.stem.length > 0 && (
            <CardDescription className="line-clamp-2">
              {exercise.contentJson.stem[0]?.value || t('exercisesTitle')}
            </CardDescription>
          )}
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <Link
            href={`/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${exercise.id}`}
          >
            {t('startExercise')}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
