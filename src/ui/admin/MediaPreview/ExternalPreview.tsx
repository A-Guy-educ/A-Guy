'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

/**
 * Admin preview for External media type.
 *
 * Reads form fields reactively via useFormFields so the preview
 * updates live as the editor changes values.
 *
 * Shows:
 * - The detected provider (e.g., "YouTube") as a badge
 * - The original URL with an "Open Link" button
 * - The fetched title (if available)
 * - A thumbnail image (if available) OR an iframe preview
 */
export const ExternalPreview: React.FC = () => {
  // Read form field values reactively
  const externalUrlField = useFormFields(([fields]) => fields.externalUrl)
  const embedProviderField = useFormFields(([fields]) => fields.embedProvider)
  const embedUrlField = useFormFields(([fields]) => fields.embedUrl)
  const embedTitleField = useFormFields(([fields]) => fields.embedTitle)
  const embedThumbnailUrlField = useFormFields(([fields]) => fields.embedThumbnailUrl)
  const embedVideoIdField = useFormFields(([fields]) => fields.embedVideoId)

  const externalUrl = externalUrlField?.value as string | undefined
  const embedProvider = embedProviderField?.value as string | undefined
  const embedUrl = embedUrlField?.value as string | undefined
  const embedTitle = embedTitleField?.value as string | undefined
  const embedThumbnailUrl = embedThumbnailUrlField?.value as string | undefined
  const embedVideoId = embedVideoIdField?.value as string | undefined

  if (!externalUrl) {
    return (
      <div style={{ padding: '16px' }}>
        <p>Paste an external URL (e.g., YouTube link) and save to see a preview.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* Provider badge */}
      {embedProvider && embedProvider !== 'generic' && (
        <div
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            marginBottom: '8px',
            borderRadius: '4px',
            backgroundColor:
              embedProvider === 'youtube'
                ? '#FF0000'
                : embedProvider === 'vimeo'
                  ? '#1ab7ea'
                  : 'var(--theme-elevation-300)',
            color: embedProvider === 'youtube' || embedProvider === 'vimeo' ? '#fff' : 'inherit',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {embedProvider}
        </div>
      )}

      {/* Title */}
      {embedTitle && <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{embedTitle}</h4>}

      {/* Original URL */}
      <p
        style={{
          margin: '0 0 8px 0',
          wordBreak: 'break-all',
          fontSize: '12px',
          opacity: 0.7,
        }}
      >
        {externalUrl}
      </p>

      {/* Open Link button */}
      <div style={{ marginBottom: '12px' }}>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            backgroundColor: 'var(--theme-elevation-300)',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '13px',
          }}
        >
          Open Link
        </a>
      </div>

      {/* Preview: thumbnail (with play overlay) for YouTube/Vimeo, iframe for others */}
      {(embedProvider === 'youtube' || embedProvider === 'vimeo') && embedThumbnailUrl ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={embedThumbnailUrl}
            alt={embedTitle || `${embedProvider} thumbnail`}
            style={{
              width: '100%',
              borderRadius: '4px',
              display: 'block',
            }}
          />
          {/* Play button overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* CSS triangle play icon */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderLeft: '16px solid white',
                  marginLeft: '3px',
                }}
              />
            </div>
          </div>
        </div>
      ) : embedUrl ? (
        <iframe
          src={embedUrl}
          style={{
            width: '100%',
            height: '200px',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '4px',
          }}
          title={embedTitle || 'External content preview'}
        />
      ) : (
        <iframe
          src={externalUrl}
          style={{
            width: '100%',
            height: '200px',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '4px',
          }}
          title="External content preview"
        />
      )}

      {/* Video ID (debug info) */}
      {embedVideoId && (
        <p style={{ margin: '8px 0 0 0', fontSize: '11px', opacity: 0.5 }}>ID: {embedVideoId}</p>
      )}
    </div>
  )
}
