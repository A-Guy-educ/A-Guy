'use client'

import { ResizablePane } from '@/ui/web/components/resizable-pane'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import React from 'react'
import { ExerciseHeader } from '../ExerciseHeader'

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

  // Trigger the existing mobile menu from the main header
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <ExerciseHeader
        exerciseTitle={exerciseTitle}
        backUrl={backUrl}
        onMenuClick={handleMenuClick}
      />

      <ResizablePane
        orientation={isDesktop ? 'horizontal' : 'vertical'}
        defaultSize={isDesktop ? 70 : 50}
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
