'use client'

import { useEffect, useState } from 'react'

interface PromptOption {
  id: string
  title: string
  promptKey: string
}

interface TranslationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (promptId?: string) => void
  targetLocale: string
  scope: string
  isTranslating: boolean
}

export function TranslationModal({
  isOpen,
  onClose,
  onConfirm,
  targetLocale,
  scope,
  isTranslating,
}: TranslationModalProps) {
  const [prompts, setPrompts] = useState<PromptOption[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    async function loadPrompts() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          '/api/prompts?where[usage][equals]=translator&where[status][equals]=published&limit=50',
          { credentials: 'include' },
        )

        if (!response.ok) {
          throw new Error('Failed to load prompts')
        }

        const data = await response.json()
        setPrompts(
          (data.docs || []).map((doc: Record<string, unknown>) => ({
            id: doc.id,
            title: doc.title,
            promptKey: doc.promptKey,
          })),
        )
      } catch {
        setError('Failed to load prompts')
      } finally {
        setIsLoading(false)
      }
    }

    loadPrompts()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setSelectedPromptId('')
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const targetLabel = targetLocale === 'en' ? 'English' : 'Hebrew'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isTranslating) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          borderRadius: 8,
          padding: 20,
          width: '90%',
          maxWidth: 450,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 4,
            color: 'var(--theme-elevation-1000)',
          }}
        >
          Translate {scope}
        </h3>
        <p
          style={{
            fontSize: 12,
            color: 'var(--theme-elevation-500)',
            marginBottom: 16,
          }}
        >
          Translate to <strong>{targetLabel}</strong>
        </p>

        {isLoading && (
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', padding: 20 }}>
            Loading prompts...
          </div>
        )}

        {!isLoading && (
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 6,
                color: 'var(--theme-elevation-700)',
              }}
            >
              Translation Prompt {prompts.length === 0 && '(none available — will use default)'}
            </label>
            {prompts.length > 0 && (
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                disabled={isTranslating}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  backgroundColor: 'var(--theme-elevation-0)',
                  color: 'var(--theme-elevation-1000)',
                  opacity: isTranslating ? 0.6 : 1,
                }}
              >
                <option value="">-- Use default prompt --</option>
                {prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--theme-error)',
              padding: '8px 12px',
              backgroundColor: 'var(--theme-error-100)',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isTranslating}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 4,
              backgroundColor: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-700)',
              cursor: isTranslating ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedPromptId || undefined)}
            disabled={isTranslating || isLoading}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              backgroundColor: isTranslating
                ? 'var(--theme-elevation-400)'
                : 'var(--theme-primary)',
              color: 'var(--theme-elevation-0)',
              cursor: isTranslating ? 'not-allowed' : 'pointer',
              opacity: isTranslating ? 0.6 : 1,
            }}
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </button>
        </div>
      </div>
    </div>
  )
}
