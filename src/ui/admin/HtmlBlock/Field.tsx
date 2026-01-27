'use client'

import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import { useEffect, useState } from 'react'

export const HtmlBlockField: UIFieldClientComponent = () => {
  const [htmlValue, setHtmlValue] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const field = useFormFields(([fields]) => fields.html)

  useEffect(() => {
    // Get the raw value from the field
    if (field?.value !== undefined) {
      setHtmlValue(String(field.value))
    }
  }, [field?.value])

  const togglePreview = () => {
    setIsPreviewOpen(!isPreviewOpen)
  }

  return (
    <div className="html-block-field">
      <div className="html-block-field__controls" style={{ marginBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={togglePreview}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--theme-elevation-100)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {isPreviewOpen ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {isPreviewOpen && htmlValue && (
        <div
          className="html-block-field__preview"
          style={{
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '4px',
            padding: '1rem',
            marginTop: '0.5rem',
            backgroundColor: 'var(--theme-elevation-0)',
            minHeight: '100px',
          }}
          dangerouslySetInnerHTML={{ __html: htmlValue }}
        />
      )}

      {isPreviewOpen && !htmlValue && (
        <div
          className="html-block-field__preview html-block-field__preview--empty"
          style={{
            border: '1px dashed var(--theme-elevation-200)',
            borderRadius: '4px',
            padding: '2rem',
            marginTop: '0.5rem',
            backgroundColor: 'var(--theme-elevation-50)',
            color: 'var(--theme-text)',
            textAlign: 'center',
          }}
        >
          No HTML content to preview
        </div>
      )}
    </div>
  )
}

export default HtmlBlockField
