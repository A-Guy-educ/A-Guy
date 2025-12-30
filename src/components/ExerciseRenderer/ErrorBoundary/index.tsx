/**
 * Error Boundary Component
 * Catches rendering errors and displays fallback UI
 */

import React from 'react'
import './index.scss'

const baseClass = 'exercise-error-boundary'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={baseClass}>
          <div className={`${baseClass}__icon`}>⚠️</div>
          <div className={`${baseClass}__title`}>
            {this.props.fallbackTitle || 'Error rendering content'}
          </div>
          {this.state.error && (
            <div className={`${baseClass}__message`}>{this.state.error.message}</div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
