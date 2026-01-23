'use client'

import Link from 'next/link'
import type { Exercise } from '@/payload-types'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/components/card'
import { Button } from '@/ui/components/button'
import { Badge } from '@/ui/components/badge'
import { useTranslations } from '@/ui/providers/I18n'
import type { ExerciseContentData, ContentBlock } from '@/ui/web/exerciserenderer/types'

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

  // Type guard: Check if content matches ExerciseContentData structure
  const isExerciseContent = (
    content: unknown,
  ): content is ExerciseContentData & { blocks: ContentBlock[] } => {
    return (
      typeof content === 'object' &&
      content !== null &&
      'blocks' in content &&
      Array.isArray((content as { blocks: unknown }).blocks)
    )
  }

  // Extract question types from content blocks
  const getQuestionTypes = () => {
    const content = exercise.content as unknown
    if (!isExerciseContent(content)) return []

    const questionBlocks = content.blocks.filter(
      (block): block is ContentBlock =>
        block.type === 'question_select' || block.type === 'question_free_response',
    )

    const types = new Set(questionBlocks.map((block) => block.type))
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
        {isExerciseContent(exercise.content) && exercise.content.blocks.length > 0 && (
          <CardDescription className="line-clamp-2">
            {exercise.content.blocks[0] &&
            'value' in exercise.content.blocks[0] &&
            typeof exercise.content.blocks[0].value === 'string'
              ? exercise.content.blocks[0].value
              : t('exercisesTitle')}
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
