'use client'

/**
 * ConvertLatexBlockButton
 *
 * Admin UI field on the Exercise edit view. When the exercise contains one or
 * more `{type:'latex'}` blocks in its content, surfaces a preview + Convert
 * button. Clicking Convert calls /api/exercises/:id/convert-latex-block which
 * parses each LaTeX block and replaces it in place with structured blocks.
 *
 * Hidden entirely when the exercise has no LaTeX block to convert.
 */
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface ContentBlockShape {
  id?: string
  type: string
  latex?: string
}

interface ContentValue {
  blocks?: ContentBlockShape[]
}

interface ConvertSuccess {
  exerciseId: string
  convertedBlockIds: string[]
  addedBlockCount: number
  totalBlocks: number
  warnings?: { line: number; message: string; rawLatex: string }[]
}

type ImportMethod = 'script' | 'ai_fallback'

export const ConvertLatexBlockButton = () => {
  const { id: exerciseId } = useDocumentInfo()
  const router = useRouter()

  // Read the current `content` value directly from the form fields state so we
  // re-render when the user adds/edits/removes a LaTeX block.
  const contentField = useFormFields(([fields]) => fields?.content)
  const contentValue = contentField?.value as ContentValue | null | undefined

  const latexBlocks = useMemo(() => {
    const blocks = Array.isArray(contentValue?.blocks) ? contentValue!.blocks! : []
    return blocks.filter(
      (b): b is ContentBlockShape & { latex: string } =>
        b?.type === 'latex' && typeof b.latex === 'string' && b.latex.trim().length > 0,
    )
  }, [contentValue])

  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConvertSuccess | null>(null)
  const [method, setMethod] = useState<ImportMethod | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  if (!exerciseId || latexBlocks.length === 0) {
    return null
  }

  const previewText = latexBlocks.map((b) => b.latex).join('\n\n% --- %\n\n')

  const handleConvert = async () => {
    setIsConverting(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/exercises/convert-latex-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Conversion failed')
        return
      }
      setResult(data.data as ConvertSuccess)
      setMethod((data.method as ImportMethod) || 'script')
      // Refresh the admin page so the editor picks up the new content blocks.
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-50)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--theme-elevation-1000)',
          marginBottom: 4,
        }}
      >
        LaTeX Block → Full Exercise
      </div>
      <p style={{ fontSize: 11, color: 'var(--theme-elevation-600)', marginBottom: 8 }}>
        This exercise has {latexBlocks.length} LaTeX block
        {latexBlocks.length === 1 ? '' : 's'}. Converting parses the LaTeX into structured blocks
        (questions, diagrams, rich text) and inserts them right after the LaTeX block. The original
        LaTeX is preserved as a source-of-truth reference and is hidden from the exercise viewer.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={handleConvert}
          disabled={isConverting}
          type="button"
          style={{
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: isConverting ? 'not-allowed' : 'pointer',
            border: 'none',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-900)',
            color: 'var(--theme-elevation-0)',
          }}
        >
          {isConverting ? 'Converting…' : 'Convert LaTeX Block'}
        </button>
        <button
          onClick={() => setShowPreview((v) => !v)}
          type="button"
          style={{
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-800)',
          }}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {showPreview && (
        <pre
          aria-label="LaTeX block preview"
          style={{
            marginTop: 8,
            padding: 8,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 4,
            backgroundColor: 'var(--theme-elevation-0)',
            fontSize: 11,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 240,
            overflow: 'auto',
            color: 'var(--theme-elevation-900)',
          }}
        >
          {previewText}
        </pre>
      )}

      {error && (
        <p style={{ color: 'var(--theme-error-500)', marginTop: 8, fontSize: 12 }}>{error}</p>
      )}

      {result && (
        <p style={{ color: 'var(--theme-success-500)', marginTop: 8, fontSize: 12 }}>
          Converted {result.convertedBlockIds.length} LaTeX block
          {result.convertedBlockIds.length === 1 ? '' : 's'} into {result.addedBlockCount}{' '}
          structured block{result.addedBlockCount === 1 ? '' : 's'}
          {method === 'ai_fallback' ? ' via AI fallback' : ''}
          {result.warnings && result.warnings.length > 0
            ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})`
            : ''}
          . The original LaTeX block remains in the editor for reference and is hidden in the
          viewer.
        </p>
      )}
    </div>
  )
}

export default ConvertLatexBlockButton
