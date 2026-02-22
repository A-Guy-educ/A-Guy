'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

import { getYouTubeEmbedUrl, isYouTubeUrl } from '@/infra/media/youtube'

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

  const youTubeEmbedUrl = getYouTubeEmbedUrl(externalUrl)

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="m-0">External Media</h3>
        {isYouTubeUrl(externalUrl) && (
          <span className="inline-block rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            YouTube
          </span>
        )}
      </div>
      <p className="mb-4 break-all text-sm">
        <strong>URL:</strong> {externalUrl}
      </p>
      <div className="mb-4">
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded bg-[var(--theme-elevation-300)] px-4 py-2 no-underline"
        >
          Open Link
        </a>
      </div>
      {youTubeEmbedUrl ? (
        <div className="relative w-full overflow-hidden rounded" style={{ paddingTop: '56.25%' }}>
          <iframe
            src={youTubeEmbedUrl}
            className="absolute inset-0 h-full w-full border-0"
            title="YouTube video"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        </div>
      ) : (
        <iframe
          src={externalUrl}
          className="h-[400px] w-full rounded border border-[var(--theme-elevation-300)]"
          title="External content"
        />
      )}
    </div>
  )
}
