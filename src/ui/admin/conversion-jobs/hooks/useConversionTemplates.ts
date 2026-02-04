/**
 * Hook for fetching and managing conversion templates
 *
 * @fileType hook
 * @domain admin
 * @pattern data-fetching-hook
 * @ai-summary React hook for managing conversion templates
 */

'use client'

import { useCallback, useState } from 'react'

export interface ConversionTemplate {
  id: string
  name: string
  description?: string
  config: {
    pageRange?: { start: number; end?: number; excludePages?: number[] }
    segmentation?: { pagesPerSegment: number }
    extraction?: { mode: string; exerciseTypes?: string[]; customInstructions?: string }
    reviewMode: 'auto' | 'segment' | 'batch' | 'manual'
  }
  additionalRounds?: Array<{
    name: string
    promptId: string
    targetField: string
    triggerCondition: string
    isEnabled: boolean
  }>
  isDefault?: boolean
  usageCount?: number
  createdAt: string
  updatedAt: string
}

export function useConversionTemplates() {
  const [templates, setTemplates] = useState<ConversionTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/conversion-templates?limit=100', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`)
      }

      const data = await response.json()
      setTemplates(data.docs || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createTemplate = useCallback(
    async (
      template: Omit<ConversionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
    ): Promise<ConversionTemplate | null> => {
      try {
        const response = await fetch('/api/conversion-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        })

        if (!response.ok) {
          throw new Error('Failed to create template')
        }

        const newTemplate = await response.json()
        setTemplates((prev) => [...prev, newTemplate])
        return newTemplate
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        return null
      }
    },
    [],
  )

  const updateTemplate = useCallback(
    async (
      id: string,
      updates: Partial<Omit<ConversionTemplate, 'id' | 'createdAt' | 'updatedAt'>>,
    ): Promise<boolean> => {
      try {
        const response = await fetch(`/api/conversion-templates/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          throw new Error('Failed to update template')
        }

        const updated = await response.json()
        setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
        return true
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        return false
      }
    },
    [],
  )

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/conversion-templates/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete template')
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      return false
    }
  }, [])

  const duplicateTemplate = useCallback(
    async (id: string): Promise<ConversionTemplate | null> => {
      const original = templates.find((t) => t.id === id)
      if (!original) return null

      return createTemplate({
        name: `${original.name} (Copy)`,
        description: original.description,
        config: original.config,
        additionalRounds: original.additionalRounds,
        isDefault: false,
      })
    },
    [templates, createTemplate],
  )

  return {
    templates,
    isLoading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  }
}
