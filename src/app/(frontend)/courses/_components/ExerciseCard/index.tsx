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

  // Extract question types from content blocks
  const getQuestionTypes = () => {
    const content = (exercise as any).content
    if (!content?.blocks || !Array.isArray(content.blocks)) return []

    const questionBlocks = content.blocks.filter(
      (block: any) =>
        block.type === 'question_select' ||
        block.type === 'question_mcq' ||
        block.type === 'question_free_response',
    )

    const types = new Set(questionBlocks.map((block: any) => block.type))
    return Array.from(types)
  }

  const getQuestionTypeBadge = (questionType: string) => {
    const badges = {
      question_mcq: { label: t('mcqBadge'), variant: 'default' as const },
      question_select: { label: t('selectBadge'), variant: 'secondary' as const },
      question_free_response: { label: t('freeResponseBadge'), variant: 'outline' as const },
    }
    return (
      badges[questionType as keyof typeof badges] || {
        label: 'Question',
        variant: 'default' as const,
      }
    )
  }

  const questionTypes = getQuestionTypes()
  const badge = questionTypes.length > 0 ? getQuestionTypeBadge(questionTypes[0] as string) : null

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('exercise')} {index + 1}
          </span>
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </div>
        <CardTitle className="text-xl">{exercise.title}</CardTitle>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(exercise as any).content &&
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          typeof (exercise as any).content === 'object' &&
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          'blocks' in (exercise as any).content &&
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          Array.isArray((exercise as any).content.blocks) &&
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          (exercise as any).content.blocks.length > 0 && (
            <CardDescription className="line-clamp-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(exercise as any).content.blocks[0]?.value || t('exercisesTitle')}
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
