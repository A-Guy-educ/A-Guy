/**
 * Error Boundary Component
 * Catches rendering errors and displays fallback UI
 */

import React from 'react'

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
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded my-2">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">
            {this.props.fallbackTitle || 'Error rendering content'}
          </div>
          {this.state.error && (
            <div className="text-sm text-red-600 dark:text-red-400 font-mono">
              {this.state.error.message}
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
