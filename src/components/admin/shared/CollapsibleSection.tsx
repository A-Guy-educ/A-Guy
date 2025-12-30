'use client'

/**
 * Collapsible section for advanced/debug panels and major section grouping
 */

import React, { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  className?: string
  /** Optional error count badge */
  errorCount?: number
  /** External control for expanded state */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onToggle?: (expanded: boolean) => void
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  className = '',
  errorCount = 0,
  isExpanded: externalIsExpanded,
  onToggle,
}: CollapsibleSectionProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(defaultExpanded)

  // Use external control if provided, otherwise use internal state
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded

  // Sync internal state with external control
  useEffect(() => {
    if (externalIsExpanded !== undefined) {
      setInternalIsExpanded(externalIsExpanded)
    }
  }, [externalIsExpanded])

  const handleToggle = () => {
    const newState = !isExpanded
    setInternalIsExpanded(newState)
    onToggle?.(newState)
  }

  return (
    <div className={className} style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={handleToggle}
        className="btn btn--style-secondary btn--size-small"
        style={{ width: '100%', justifyContent: 'space-between', display: 'flex' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {title}
          {errorCount > 0 && (
            <span
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--theme-error-500)',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: '600',
                padding: '0.125rem 0.375rem',
                borderRadius: '9999px',
                minWidth: '1.25rem',
                textAlign: 'center',
              }}
            >
              {errorCount}
            </span>
          )}
        </span>
        <span
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </button>
      {isExpanded && <div style={{ marginTop: '0.75rem' }}>{children}</div>}
    </div>
  )
}
