'use client'

import type { Exercise } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { Badge } from '@/ui/web/components/badge'
import type { ExerciseContentData, ContentBlock } from '@/ui/web/exerciserenderer/types'

interface ExerciseCardProps {
  exercise: Exercise
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  index: number
}

function isExerciseContent(
  content: unknown,
): content is ExerciseContentData & { blocks: ContentBlock[] } {
  return (
    typeof content === 'object' &&
    content !== null &&
    'blocks' in content &&
    Array.isArray((content as { blocks: unknown }).blocks)
  )
}

function getQuestionTypes(exercise: Exercise): string[] {
  const content = exercise.content as unknown
  if (!isExerciseContent(content)) return []

  const questionBlocks = content.blocks.filter(
    (block): block is ContentBlock =>
      block.type === 'question_select' || block.type === 'question_free_response',
  )

  const types = new Set(questionBlocks.map((block) => block.type))
  return Array.from(types)
}

function getQuestionTypeBadge(questionType: string, t: ReturnType<typeof useTranslations>) {
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

export function ExerciseCard({
  exercise,
  courseSlug,
  chapterSlug,
  lessonSlug,
  index,
}: ExerciseCardProps) {
  const t = useTranslations('courses')
  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${exercise.id}`

  const questionTypes = getQuestionTypes(exercise)
  const firstBadge = questionTypes.length > 0 ? getQuestionTypeBadge(questionTypes[0], t) : null

  // Extract first block text as description
  let description: string | undefined
  if (isExerciseContent(exercise.content) && exercise.content.blocks.length > 0) {
    const firstBlock = exercise.content.blocks[0]
    if ('value' in firstBlock && typeof firstBlock.value === 'string') {
      description = firstBlock.value
    }
  }

  return (
    <UnifiedCard
      title={exercise.title || t('exercisesTitle')}
      description={description}
      label={`${t('exercise')} ${index + 1}`}
      buttonLabel={t('startExercise')}
      buttonHref={href}
      children={
        firstBadge ? (
          <Badge variant={firstBadge.variant} className="self-start">
            {firstBadge.label}
          </Badge>
        ) : null
      }
    />
  )
}
