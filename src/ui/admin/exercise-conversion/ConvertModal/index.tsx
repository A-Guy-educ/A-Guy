'use client'

import { useEffect, useState } from 'react'

interface ConvertModalProps {
  lessonId: string
  mediaId: string
  filename: string
  onClose: () => void
}

interface PromptOption {
  id: string
  title: string
  key: string
  type: string
  usage: string
}

export function ConvertModal({ lessonId, mediaId, filename, onClose }: ConvertModalProps) {
  const [extractorPrompts, setExtractorPrompts] = useState<PromptOption[]>([])
  const [verifierPrompts, setVerifierPrompts] = useState<PromptOption[]>([])
  const [selectedExtractor, setSelectedExtractor] = useState<string>('')
  const [selectedVerifier, setSelectedVerifier] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadPrompts() {
      try {
        const response = await fetch('/api/prompts/for-conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId }),
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to load prompts')
        }

        const data = await response.json()
        setExtractorPrompts(data.extractors || [])
        setVerifierPrompts(data.verifiers || [])
      } catch {
        setError('Failed to load prompts')
      } finally {
        setIsLoading(false)
      }
    }

    loadPrompts()
  }, [lessonId])

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/exercises/convert/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          mediaId,
          extractorPromptId: selectedExtractor,
          verifierPromptId: selectedVerifier,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Queue failed')
      }

      const data = await response.json()
      setSuccess(`Conversion queued! Job ID: ${data.jobId}`)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Queue failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal content */}
      <div className="relative z-[1001] bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Convert PDF to Exercises</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">File: {filename}</p>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded p-3 mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 text-green-700 rounded p-3 mb-4 text-sm">{success}</div>
        )}

        {isLoading ? (
          <div className="text-zinc-500">Loading prompts...</div>
        ) : (
          <div className="space-y-4">
            {/* Extractor select */}
            <div>
              <label htmlFor="extractor" className="block text-sm font-medium mb-1">
                Extractor Prompt
              </label>
              <select
                id="extractor"
                value={selectedExtractor}
                onChange={(e) => setSelectedExtractor(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
              >
                <option value="">Select extractor prompt...</option>
                {extractorPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} ({prompt.key})
                  </option>
                ))}
              </select>
            </div>

            {/* Verifier select */}
            <div>
              <label htmlFor="verifier" className="block text-sm font-medium mb-1">
                Verifier Prompt
              </label>
              <select
                id="verifier"
                value={selectedVerifier}
                onChange={(e) => setSelectedVerifier(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
              >
                <option value="">Select verifier prompt...</option>
                {verifierPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} ({prompt.key})
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm font-medium disabled:opacity-50"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedExtractor || !selectedVerifier}
              >
                {isSubmitting ? 'Queuing...' : 'Queue Conversion'}
              </button>
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          type="button"
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          onClick={onClose}
        >
          <span className="sr-only">Close</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
