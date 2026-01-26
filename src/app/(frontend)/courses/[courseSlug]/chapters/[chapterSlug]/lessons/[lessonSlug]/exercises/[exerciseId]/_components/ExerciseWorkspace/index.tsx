'use client'

import { ResizablePane } from '@/ui/web/components/resizable-pane'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import React, { useState, useCallback } from 'react'
import { cn } from '@/infra/utils/ui'
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
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Mobile mode state
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode())
  const [chatExpandedInPdf, setChatExpandedInPdf] = useState(false)

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

  // Chat expand handler (triggered by user typing/sending message)
  const handleChatExpand = useCallback(() => {
    if (!isDesktop && viewMode === 'PDF') {
      setChatExpandedInPdf(true)
    }
  }, [isDesktop, viewMode])

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
          isMobile={false}
          viewMode={viewMode}
          onModeToggle={handleModeToggle}
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
        isMobile={true}
        viewMode={viewMode}
        onModeToggle={handleModeToggle}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* PDF section - always rendered, height controlled by CSS */}
        <div
          className={cn(
            'bg-muted flex items-center justify-center overflow-hidden',
            viewMode === 'CHAT' && 'h-0 opacity-0 pointer-events-none',
            viewMode === 'PDF' && !chatExpandedInPdf && 'flex-1',
            viewMode === 'PDF' && chatExpandedInPdf && 'flex-1',
          )}
        >
          {pdfContent}
        </div>

        {/* Resize handle - only visible when expanded */}
        {viewMode === 'PDF' && chatExpandedInPdf && <div className="h-1 bg-border flex-shrink-0" />}

        {/* Chat section - always rendered, height controlled by CSS */}
        <div
          className={cn(
            'bg-background flex flex-col overflow-hidden flex-shrink-0',
            viewMode === 'CHAT' && 'flex-1',
            viewMode === 'PDF' && !chatExpandedInPdf && 'h-auto',
            viewMode === 'PDF' && chatExpandedInPdf && 'flex-1',
          )}
        >
          {React.cloneElement(
            chatContent as React.ReactElement<{
              onChatInteraction?: () => void
              displayMode?: 'full' | 'input-only'
            }>,
            {
              onChatInteraction: handleChatExpand,
              displayMode:
                viewMode === 'CHAT' || (viewMode === 'PDF' && chatExpandedInPdf)
                  ? 'full'
                  : ('input-only' as const),
            },
          )}
        </div>
      </div>
    </div>
  )
}
