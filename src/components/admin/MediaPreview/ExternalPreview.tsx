'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

export const ExternalPreview: React.FC = () => {
  const externalUrlField = useFormFields(([fields]) => fields.externalUrl)

  const externalUrl = externalUrlField?.value as string | undefined

  if (!externalUrl) {
    return (
      <div className="p-4">
        <p>No external URL provided</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h3 className="mb-2">External Media</h3>
      <p className="mb-4 break-all">
        <strong>URL:</strong> {externalUrl}
      </p>
      <div className="mb-4">
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-[var(--theme-elevation-300)] rounded no-underline"
        >
          🔗 Open Link
        </a>
      </div>
      <iframe
        src={externalUrl}
        className="w-full h-[400px] border border-[var(--theme-elevation-300)] rounded"
        title="External content"
      />
    </div>
  )
}

