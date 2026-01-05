'use client'

import { ExerciseRenderer } from '@/components/ExerciseRenderer'
import type { ExerciseContentData } from '@/components/ExerciseRenderer/types'
import './index.scss'

interface ExercisePageContentProps {
  contentJson: unknown
}

export function ExercisePageContent({ contentJson }: ExercisePageContentProps) {
  return (
    <div className="exercise-page-content">
      <ExerciseRenderer
        content={contentJson as ExerciseContentData}
        mode="student"
        showCheckAnswer={true}
      />
    </div>
  )
}
