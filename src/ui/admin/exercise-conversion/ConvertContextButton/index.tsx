'use client'

import { Suspense, useState } from 'react'
import { ConvertContextModal } from '../ConvertContextModal'

interface ConvertContextButtonProps {
  lessonId: string
  mediaId: string
  filename: string
  /** Override the button label. Defaults to "Convert Context". */
  label?: string
}

/**
 * Convert Context Button Component
 *
 * Triggers the context extraction modal for a specific content file.
 * Shows a button styled identically to existing V1/V2/V3 conversion buttons.
 */
export function ConvertContextButton({
  lessonId,
  mediaId,
  filename,
  label = 'Convert Context',
}: ConvertContextButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 500,
          border: 'none',
          borderRadius: 3,
          backgroundColor: 'var(--theme-elevation-900)',
          color: 'var(--theme-elevation-0)',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>

      <Suspense
        fallback={
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
          >
            <div
              style={{
                backgroundColor: 'var(--theme-elevation-0)',
                borderRadius: 8,
                padding: 20,
              }}
            >
              Loading...
            </div>
          </div>
        }
      >
        <ConvertContextModal
          lessonId={lessonId}
          mediaId={mediaId}
          filename={filename}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </Suspense>
    </>
  )
}

export default ConvertContextButton
