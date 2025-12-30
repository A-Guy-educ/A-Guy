/**
 * Error Boundary for Preview Components
 * Catches runtime errors in preview rendering and displays a friendly error message
 * Prevents preview errors from crashing the entire admin interface
 */

import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PreviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Preview rendering error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '1rem',
            border: '2px solid var(--theme-error-500)',
            borderRadius: '4px',
            background: 'var(--theme-elevation-50)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <h4
              style={{
                margin: 0,
                color: 'var(--theme-error-500)',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              {this.props.fallbackTitle || 'Preview Error'}
            </h4>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--theme-elevation-700)',
              fontFamily: 'monospace',
              background: 'var(--theme-elevation-150)',
              padding: '0.5rem',
              borderRadius: '4px',
              overflowX: 'auto',
            }}
          >
            {this.state.error?.message || 'An unknown error occurred while rendering the preview'}
          </p>
          <p
            style={{
              marginTop: '0.5rem',
              marginBottom: 0,
              fontSize: '0.75rem',
              color: 'var(--theme-elevation-600)',
            }}
          >
            The preview could not be rendered, but your data is safe. Check the console for details
            or try editing the spec in the Advanced JSON panel.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
