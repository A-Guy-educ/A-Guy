/**
 * Conversion Form Component
 *
 * @fileType component
 * @domain admin
 * @pattern form
 * @ai-summary Form for configuring and starting PDF-to-exercise conversion
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { LessonSelector } from '../LessonSelector'
import { PdfSelector } from '../PdfSelector'

interface PromptOption {
  id: string
  title: string
  key: string
  type: string
  usage: string
  status: string
}

interface LessonOption {
  id: string
  title: string
  chapterTitle?: string
}

interface ConversionFormProps {
  onQueued: () => void
}

export function ConversionForm({ onQueued }: ConversionFormProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [extractorPromptId, setExtractorPromptId] = useState<string>('')
  const [verifierPromptId, setVerifierPromptId] = useState<string>('')
  const [diagramPromptId, setDiagramPromptId] = useState<string>('')
  const [prompts, setPrompts] = useState<{
    extractors: PromptOption[]
    verifiers: PromptOption[]
    diagramGenerators: PromptOption[]
  }>({ extractors: [], verifiers: [], diagramGenerators: [] })
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!selectedLessonId) {
      setPrompts({ extractors: [], verifiers: [], diagramGenerators: [] })
      return
    }

    async function fetchPrompts() {
      setIsLoadingPrompts(true)
      setError(null)
      try {
        const response = await fetch('/api/prompts/for-conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: selectedLessonId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to fetch prompts')
        }

        const data = await response.json()
        setPrompts({
          extractors: data.extractors || [],
          verifiers: data.verifiers || [],
          diagramGenerators: data.diagramGenerators || [],
        })
      } catch (err) {
        console.error('Failed to fetch prompts:', err)
        setError(err instanceof Error ? err.message : 'Failed to load prompts')
      } finally {
        setIsLoadingPrompts(false)
      }
    }

    fetchPrompts()
  }, [selectedLessonId])

  const handleLessonSelect = useCallback((lessonId: string, _lesson: LessonOption) => {
    setSelectedLessonId(lessonId)
    setSelectedMediaId(null)
    setExtractorPromptId('')
    setVerifierPromptId('')
    setDiagramPromptId('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!selectedLessonId || !selectedMediaId || !extractorPromptId || !verifierPromptId) {
      setError('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const body: Record<string, string> = {
        lessonId: selectedLessonId,
        mediaId: selectedMediaId,
        extractorPromptId,
        verifierPromptId,
      }

      if (diagramPromptId) {
        body.diagramPromptId = diagramPromptId
      }

      const response = await fetch('/api/exercises/convert/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to queue conversion')
      }

      setSuccess(true)
      onQueued()

      // Reset form after 2 seconds
      setTimeout(() => {
        setSuccess(false)
        setSelectedLessonId(null)
        setSelectedMediaId(null)
        setExtractorPromptId('')
        setVerifierPromptId('')
        setDiagramPromptId('')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue conversion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = selectedLessonId && selectedMediaId && extractorPromptId && verifierPromptId

  return (
    <form
      className="bg-white rounded-lg border border-gray-200 p-4 space-y-4"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-semibold">Convert PDF to Exercises</h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          Conversion job queued successfully!
        </div>
      )}

      <LessonSelector selectedLessonId={selectedLessonId} onSelectLesson={handleLessonSelect} />

      {selectedLessonId && (
        <PdfSelector
          lessonId={selectedLessonId}
          selectedMediaId={selectedMediaId}
          onSelectMedia={setSelectedMediaId}
        />
      )}

      {isLoadingPrompts ? (
        <div className="text-sm text-gray-500">Loading prompts...</div>
      ) : (
        <>
          <div className="space-y-1">
            <label htmlFor="extractor-prompt" className="block text-sm font-medium text-gray-700">
              Extractor Prompt *
            </label>
            <select
              id="extractor-prompt"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={extractorPromptId}
              onChange={(e) => setExtractorPromptId(e.target.value)}
              required
            >
              <option value="">Select extractor prompt</option>
              {prompts.extractors.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="verifier-prompt" className="block text-sm font-medium text-gray-700">
              Verifier Prompt *
            </label>
            <select
              id="verifier-prompt"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={verifierPromptId}
              onChange={(e) => setVerifierPromptId(e.target.value)}
              required
            >
              <option value="">Select verifier prompt</option>
              {prompts.verifiers.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="diagram-prompt" className="block text-sm font-medium text-gray-700">
              Diagram Generator (optional)
            </label>
            <select
              id="diagram-prompt"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={diagramPromptId}
              onChange={(e) => setDiagramPromptId(e.target.value)}
            >
              <option value="">None</option>
              {prompts.diagramGenerators.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? 'Queuing...' : 'Start Conversion'}
      </button>
    </form>
  )
}
