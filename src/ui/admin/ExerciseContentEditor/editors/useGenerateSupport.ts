'use client'

import React from 'react'
import type { InlineRichText } from '@/server/payload/collections/Exercises/types'
import type { SupportFields } from './HintSolutionPanel'

interface UseGenerateSupportOptions {
  exerciseId: string | number | undefined
  blockId: string
  onBatchChange: (fields: SupportFields) => void
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
  onBatchChange,
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
          const fields = buildSupportFields(generated, overwrite)
          onBatchChange(fields)
          onExpandPanel()
        }
      } catch {
        setGenerateError('Network error. Please try again.')
      } finally {
        setIsGenerating(false)
      }
    },
    [exerciseId, blockId, isGenerating, onBatchChange, onExpandPanel],
  )

  return { isGenerating, generateError, handleGenerate }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSupportFields(generated: any, overwrite: boolean): SupportFields {
  const fields: SupportFields = {}

  if (generated.hints?.length) {
    const hintText = generated.hints.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')
    fields.hint = createRichText(hintText)
  } else if (overwrite) {
    fields.hint = undefined
  }

  if (generated.solution) {
    fields.solution = createRichText(generated.solution)
  } else if (overwrite) {
    fields.solution = undefined
  }

  if (generated.fullSolution) {
    fields.fullSolution = createRichText(generated.fullSolution)
  } else if (overwrite) {
    fields.fullSolution = undefined
  }

  return fields
}
