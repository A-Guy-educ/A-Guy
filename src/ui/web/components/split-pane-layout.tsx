'use client'

import { cn } from '@/infra/utils/ui'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { ResizablePane } from '@/ui/web/components/resizable-pane'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface SplitPaneLayoutProps {
  primaryContent: React.ReactNode
  chatContent: React.ReactNode
  className?: string
  storageKey?: string
  defaultSize?: number
  minSize?: number
  maxSize?: number
}

type ViewMode = 'PDF' | 'CHAT'

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'PDF'
  const saved = localStorage.getItem('view-mode')
  if (saved === 'PDF' || saved === 'CHAT') return saved
  return 'PDF'
}

export function SplitPaneLayout({
  primaryContent,
  chatContent,
  className,
  storageKey = 'split-pane-size',
  defaultSize = 70,
  minSize = 20,
  maxSize = 80,
}: SplitPaneLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [chatExpandedInPdf, setChatExpandedInPdf] = useState(false)
  const [pdfHeightPercent, setPdfHeightPercent] = useState(defaultSize)
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          setPdfHeightPercent(parsed)
        }
      }
    }
  }, [storageKey, minSize, maxSize])

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, pdfHeightPercent.toString())
    }
  }, [pdfHeightPercent, storageKey])

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem('view-mode', viewMode)
    }
  }, [viewMode, storageKey])

  useEffect(() => {
    const handleIncorrectAnswer = () => {
      if (!isDesktop && viewMode === 'PDF') {
        setChatExpandedInPdf(true)
      }
    }
    window.addEventListener('exercise-incorrect-answer', handleIncorrectAnswer)
    return () => window.removeEventListener('exercise-incorrect-answer', handleIncorrectAnswer)
  }, [isDesktop, viewMode])

  const handleModeToggle = useCallback(() => {
    setViewMode((prev) => {
      const newMode = prev === 'PDF' ? 'CHAT' : 'PDF'
      if (newMode === 'PDF') {
        setChatExpandedInPdf(false)
      }
      return newMode
    })
  }, [])

  const handleChatExpand = useCallback(() => {
    if (!isDesktop && viewMode === 'PDF') {
      setChatExpandedInPdf(true)
    }
  }, [isDesktop, viewMode])

  const handleMouseDown = () => {
    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.body.style.userSelect = 'auto'
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const percentage = ((clientY - rect.top) / rect.height) * 100

    if (percentage >= minSize && percentage <= maxSize) {
      setPdfHeightPercent(percentage)
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('touchmove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchend', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('touchmove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchend', handleMouseUp)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging])

  if (isDesktop) {
    return (
      <div className={cn('flex flex-col overflow-hidden', className)}>
        <ResizablePane
          orientation="horizontal"
          defaultSize={defaultSize}
          minSize={minSize}
          maxSize={maxSize}
          storageKey={storageKey}
          className="flex-1"
        >
          <div className="h-full overflow-hidden min-h-0">{primaryContent}</div>
          <div className="bg-background flex flex-col overflow-hidden h-full">{chatContent}</div>
        </ResizablePane>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('flex-1 overflow-hidden flex flex-col', className)}>
      <div
        className={cn(
          'overflow-hidden relative',
          viewMode === 'CHAT' && 'h-0 opacity-0 pointer-events-none',
          viewMode === 'PDF' && !chatExpandedInPdf && 'flex-1',
        )}
        style={
          viewMode === 'PDF' && chatExpandedInPdf ? { flex: `0 0 ${pdfHeightPercent}%` } : undefined
        }
      >
        {primaryContent}
        {isDragging && <div className="absolute inset-0 z-10" />}
      </div>

      {viewMode === 'PDF' && chatExpandedInPdf && (
        <div
          className={cn(
            'h-4 cursor-ns-resize border-y border-border bg-muted flex items-center justify-center shrink-0 z-20 transition-colors',
            isDragging && 'bg-primary/10',
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          role="separator"
          aria-valuenow={pdfHeightPercent}
          aria-valuemin={minSize}
          aria-valuemax={maxSize}
          aria-label="Resize panels"
        >
          <div
            className={cn(
              'w-10 h-1 bg-muted-foreground/30 rounded-full transition-all',
              isDragging && 'bg-primary',
              !isDragging && 'hover:bg-primary hover:scale-110',
            )}
          />
        </div>
      )}

      <div
        className={cn(
          'bg-background flex flex-col overflow-hidden relative',
          viewMode === 'CHAT' && 'flex-1',
          viewMode === 'PDF' && !chatExpandedInPdf && 'flex-shrink-0 h-auto',
          viewMode === 'PDF' && chatExpandedInPdf && 'flex-1',
        )}
      >
        {React.cloneElement(
          chatContent as React.ReactElement<{
            onChatInteraction?: () => void
            displayMode?: 'full' | 'input-only'
            isMobile?: boolean
            viewMode?: ViewMode
            onModeToggle?: () => void
          }>,
          {
            onChatInteraction: handleChatExpand,
            displayMode:
              viewMode === 'CHAT' || (viewMode === 'PDF' && chatExpandedInPdf)
                ? 'full'
                : ('input-only' as const),
            isMobile: true,
            viewMode,
            onModeToggle: handleModeToggle,
          },
        )}
        {isDragging && <div className="absolute inset-0 z-10" />}
      </div>
    </div>
  )
}
