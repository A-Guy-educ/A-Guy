'use client'

/**
 * Inline error display component
 */

import React from 'react'
import type { EditorError } from './types'

interface ErrorDisplayProps {
  errors?: EditorError[]
  className?: string
}

export function ErrorDisplay({ errors, className = '' }: ErrorDisplayProps) {
  if (!errors || errors.length === 0) return null

  return (
    <div
      className={`field-error ${className}`}
      style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}
    >
      <strong>
        {errors.length === 1 ? 'Validation error' : `${errors.length} validation errors`}
      </strong>
      <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem', listStyle: 'disc' }}>
        {errors.map((error, idx) => (
          <li key={idx}>
            {error.path && <strong>{error.path}:</strong>} {error.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
