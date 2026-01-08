'use client'

import React from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import { ResizablePane } from '@/components/ui/resizable-pane'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl: string
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

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <ExerciseHeader exerciseTitle={exerciseTitle} backUrl={backUrl} />

      <ResizablePane
        orientation={isDesktop ? 'horizontal' : 'vertical'}
        defaultSize={isDesktop ? 70 : 50}
        minSize={20}
        maxSize={80}
        storageKey="exercise-split-size"
        className="flex-1"
      >
        {/* PDF Viewer Section */}
        <div className="bg-[#525659] flex items-center justify-center p-4 overflow-hidden">
          {pdfContent}
        </div>

        {/* Chat Section */}
        <div className="bg-background flex flex-col overflow-hidden h-full">{chatContent}</div>
      </ResizablePane>
    </div>
  )
}
