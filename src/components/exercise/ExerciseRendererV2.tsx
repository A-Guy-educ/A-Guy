import React from 'react'
import type { ExerciseContent } from '@/contracts'
import { BlockRenderer } from './BlockRenderer'

interface ExerciseRendererProps {
  content: ExerciseContent
  mode?: 'student' | 'preview'
}

export function ExerciseRendererV2({ content, mode = 'student' }: ExerciseRendererProps) {
  if (!content || !content.stem || !Array.isArray(content.stem)) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No content available</p>
      </div>
    )
  }

  return (
    <div className="exercise-content max-w-3xl mx-auto">
      <div className="space-y-4">
        {content.stem.map((block, index) => (
          <BlockRenderer key={block.id || index} block={block} depth={0} />
        ))}
      </div>
    </div>
  )
}
