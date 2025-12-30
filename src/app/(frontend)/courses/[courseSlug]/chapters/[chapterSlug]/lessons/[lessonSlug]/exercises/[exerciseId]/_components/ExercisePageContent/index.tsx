'use client'

import { ExerciseRenderer } from '@/components/ExerciseRenderer'
import type { ExerciseContent, AnswerSpec } from '@/contracts'
import './index.scss'

interface ExercisePageContentProps {
  contentJson: unknown
  answerSpecJson: unknown
  questionType: 'mcq' | 'true_false' | 'free_response'
}

export function ExercisePageContent({
  contentJson,
  answerSpecJson,
  questionType,
}: ExercisePageContentProps) {
  return (
    <div className="exercise-page-content">
      <ExerciseRenderer
        content={contentJson as ExerciseContent}
        answerSpec={answerSpecJson as AnswerSpec}
        questionType={questionType}
        mode="student"
        showCheckAnswer={true}
      />
    </div>
  )
}
