'use client'

import React from 'react'
import type { InlineRichText } from '@/server/payload/collections/Exercises/types'

interface UseGenerateSupportOptions {
  exerciseId: string | number | undefined
  blockId: string
  onChange: (field: 'hint' | 'solution' | 'fullSolution', value: InlineRichText | undefined) => void
  onExpandPanel: () => void
}

interface UseGenerateSupportReturn {
  isGenerating: boolean
  generateError: string | null
  handleGenerate: (overwrite: boolean) => Promise<void>
}

function createRichText(value: string): InlineRichText {
  return {
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  }
}

export function useGenerateSupport({
  exerciseId,
  blockId,
  onChange,
  onExpandPanel,
}: UseGenerateSupportOptions): UseGenerateSupportReturn {
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generateError, setGenerateError] = React.useState<string | null>(null)

  const handleGenerate = React.useCallback(
    async (overwrite: boolean) => {
      if (!exerciseId || isGenerating) return

      setIsGenerating(true)
      setGenerateError(null)

      try {
        const response = await fetch('/api/exercises/generate-support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'section',
            id: exerciseId,
            blockId,
            options: {
              overwrite,
              targetFields: ['hints', 'solution', 'fullSolution'],
            },
          }),
        })

        const data = await response.json()

        if (!data.success) {
          setGenerateError(data.error || 'Generation failed')
          return
        }

        const generated = data.data?.generated
        if (generated) {
          applyGenerated(generated, overwrite, onChange)
          onExpandPanel()
        }
      } catch {
        setGenerateError('Network error. Please try again.')
      } finally {
        setIsGenerating(false)
      }
    },
    [exerciseId, blockId, isGenerating, onChange, onExpandPanel],
  )

  return { isGenerating, generateError, handleGenerate }
}

function applyGenerated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generated: any,
  overwrite: boolean,
  onChange: (
    field: 'hint' | 'solution' | 'fullSolution',
    value: InlineRichText | undefined,
  ) => void,
) {
  if (generated.hints?.length) {
    const hintText = generated.hints.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')
    onChange('hint', createRichText(hintText))
  } else if (overwrite) {
    onChange('hint', undefined)
  }
  if (generated.solution) {
    onChange('solution', createRichText(generated.solution))
  } else if (overwrite) {
    onChange('solution', undefined)
  }
  if (generated.fullSolution) {
    onChange('fullSolution', createRichText(generated.fullSolution))
  } else if (overwrite) {
    onChange('fullSolution', undefined)
  }
}
