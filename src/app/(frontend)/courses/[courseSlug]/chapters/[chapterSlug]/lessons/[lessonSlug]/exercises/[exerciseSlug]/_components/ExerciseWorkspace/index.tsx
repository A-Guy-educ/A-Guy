'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { cn } from '@/infra/utils/ui'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { ResizablePane } from '@/ui/web/components/resizable-pane'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import type { ViewMode } from './exercise-workspace-types'
import { getInitialViewMode } from './exercise-workspace-utils'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  pdfContent: React.ReactNode
  chatContent: React.ReactNode
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  pdfContent,
  chatContent,
}: ExerciseWorkspaceProps) {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const pathname = usePathname()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Mobile mode state
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode())
  const [chatExpandedInPdf, setChatExpandedInPdf] = useState(false)
  const [pdfHeightPercent, setPdfHeightPercent] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Load saved split size from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('exercise-split-size')
    if (saved) {
      const parsed = parseFloat(saved)
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
        setPdfHeightPercent(parsed)
      }
    }
  }, [])

  // Save split size to localStorage when it changes
  useEffect(() => {
    if (chatExpandedInPdf) {
      localStorage.setItem('exercise-split-size', pdfHeightPercent.toString())
    }
  }, [pdfHeightPercent, chatExpandedInPdf])

  // Mode toggle handler
  const handleModeToggle = useCallback(() => {
    setViewMode((prev) => {
      const newMode = prev === 'PDF' ? 'CHAT' : 'PDF'

      // When switching to PDF mode, collapse any expanded chat
      if (newMode === 'PDF') {
        setChatExpandedInPdf(false)
      }

      return newMode
    })
  }, [])

  // Chat expand handler (triggered by user sending message)
  const handleChatExpand = useCallback(() => {
    if (!isDesktop && viewMode === 'PDF') {
      setChatExpandedInPdf(true)
    }
  }, [isDesktop, viewMode])

  // Manual resize handlers
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

    // Constrain between 20% and 80%
    if (percentage >= 20 && percentage <= 80) {
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

  // Trigger the existing mobile menu from the main header
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  // Desktop: use existing ResizablePane layout (unchanged)
  if (isDesktop) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
        <ExerciseHeader
          exerciseTitle={exerciseTitle}
          backUrl={backUrl}
          onMenuClick={handleMenuClick}
          user={user}
          isAuthLoading={isAuthLoading}
          currentUrl={pathname}
        />

        <ResizablePane
          orientation="horizontal"
          defaultSize={70}
          minSize={20}
          maxSize={80}
          storageKey="exercise-split-size"
          className="flex-1"
        >
          {/* PDF Viewer Section */}
          <div className="bg-muted flex items-center justify-center h-full overflow-hidden">
            {pdfContent}
          </div>

          {/* Chat Section */}
          <div className="bg-background flex flex-col overflow-hidden h-full">{chatContent}</div>
        </ResizablePane>
      </div>
    )
  }

  // Mobile: mode-based rendering with CSS show/hide
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <ExerciseHeader
        exerciseTitle={exerciseTitle}
        backUrl={backUrl}
        onMenuClick={handleMenuClick}
        user={user}
        isAuthLoading={isAuthLoading}
        currentUrl={pathname}
      />

      {/* Mobile: Consistent flex container for all 3 states */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col">
        {/* PDF section - always in same position, never unmounts */}
        <div
          className={cn(
            'bg-muted flex items-center justify-center overflow-hidden relative',
            // State 1 (CHAT): Hidden
            viewMode === 'CHAT' && 'h-0 opacity-0 pointer-events-none',
            // State 2 (PDF collapsed): Full height
            viewMode === 'PDF' && !chatExpandedInPdf && 'flex-1',
          )}
          style={
            // State 3 (PDF expanded): Fixed height percentage
            viewMode === 'PDF' && chatExpandedInPdf
              ? { flex: `0 0 ${pdfHeightPercent}%` }
              : undefined
          }
        >
          {pdfContent}
          {/* Overlay to prevent iframe from capturing mouse during drag */}
          {isDragging && <div className="absolute inset-0 z-10" />}
        </div>

        {/* Resize handle - only visible in state 3 */}
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
            aria-valuemin={20}
            aria-valuemax={80}
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

        {/* Chat section - always in same position */}
        <div
          className={cn(
            'bg-background flex flex-col overflow-hidden relative',
            // State 1 (CHAT): Full height
            viewMode === 'CHAT' && 'flex-1',
            // State 2 (PDF collapsed): Auto height (just input bar)
            viewMode === 'PDF' && !chatExpandedInPdf && 'flex-shrink-0 h-auto',
            // State 3 (PDF expanded): Remaining space
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
          {/* Overlay to prevent iframe from capturing mouse during drag */}
          {isDragging && <div className="absolute inset-0 z-10" />}
        </div>
      </div>
    </div>
  )
}
