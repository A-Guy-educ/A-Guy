'use client'

import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'

interface ExercisePageContentProps {
  contentJson: unknown
}

export function ExercisePageContent({ contentJson }: ExercisePageContentProps) {
  return (
    <div className="mt-8 p-8 md:p-6 sm:p-4 bg-card rounded-lg shadow-sm">
      <ExerciseRenderer
        content={contentJson as ExerciseContentData}
        mode="student"
        showCheckAnswer={true}
      />
    </div>
  )
}
