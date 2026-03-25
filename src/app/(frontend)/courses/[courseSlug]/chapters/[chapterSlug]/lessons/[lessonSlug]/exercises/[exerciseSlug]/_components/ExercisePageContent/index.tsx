'use client'

import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'

interface ExercisePageContentProps {
  contentJson: unknown
  showQuestionNumbering?: boolean
}

export function ExercisePageContent({
  contentJson,
  showQuestionNumbering = false,
}: ExercisePageContentProps) {
  return (
    <div className="mt-8 p-card-padding-lg md:p-card-padding sm:p-card-padding-sm bg-card rounded-lg shadow-elevation-1">
      <ExerciseRenderer
        content={contentJson as ExerciseContentData}
        mode="student"
        showCheckAnswer={true}
        showExerciseNumber={showQuestionNumbering}
      />
    </div>
  )
}
