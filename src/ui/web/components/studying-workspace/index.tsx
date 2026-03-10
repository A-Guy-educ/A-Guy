'use client'

import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { StudyModeProvider, useStudyMode } from '@/ui/web/providers/StudyMode'
import { WorkspaceHeader } from './WorkspaceHeader'
import { ContentCanvas } from './ContentCanvas'
import { StudyingSidebar, type ExerciseItem } from '@/ui/web/components/studying-sidebar'
import { ChatSlidePanel } from './ChatSlidePanel'
import { TestModeTimer } from './TestModeTimer'
import { TestModeGuard } from './TestModeGuard'

/**
 * @fileType component
 * @domain study-mode
 * @pattern workspace-layout
 * @ai-summary Master workspace layout combining sidebar, content canvas, and chat panel
 */

interface StudyingWorkspaceProps {
  children: React.ReactNode
  lessonTitle: string
  lessonId: string
  exercises: ExerciseItem[]
  backUrl?: string
  chatContent?: React.ReactNode
  className?: string
}

/**
 * Inner workspace component that uses the context
 */
function StudyingWorkspaceInner({
  children,
  lessonTitle,
  exercises,
  backUrl,
  chatContent,
  className,
}: StudyingWorkspaceProps) {
  const { mode, isChatOpen, setIsChatOpen } = useStudyMode()
  const [currentExerciseId, setCurrentExerciseId] = useState<string | undefined>(exercises[0]?.id)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Track scroll position per mode
  const scrollPositionsRef = useRef<Record<string, number>>({})

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Save scroll position when mode changes
  useEffect(() => {
    if (contentScrollRef.current) {
      scrollPositionsRef.current[mode] = contentScrollRef.current.scrollTop
    }
  }, [mode])

  // Restore scroll position when returning to a mode
  useEffect(() => {
    if (contentScrollRef.current && scrollPositionsRef.current[mode] !== undefined) {
      contentScrollRef.current.scrollTop = scrollPositionsRef.current[mode]
    }
  }, [mode])

  const handleExerciseSelect = (exerciseId: string) => {
    setCurrentExerciseId(exerciseId)
  }

  return (
    <TestModeGuard>
      <div
        className={cn('fixed inset-0 bg-mode-bg flex flex-col overflow-hidden', className)}
        data-study-mode={mode}
      >
        {/* Header */}
        <WorkspaceHeader lessonTitle={lessonTitle} backUrl={backUrl} className="flex-shrink-0" />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - hidden on mobile, will use bottom sheet */}
          {!isMobile && (
            <div className="flex-shrink-0 p-4">
              <StudyingSidebar
                exercises={exercises}
                currentExerciseId={currentExerciseId}
                onExerciseSelect={handleExerciseSelect}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </div>
          )}

          {/* Content canvas */}
          <ContentCanvas scrollRef={contentScrollRef}>{children}</ContentCanvas>

          {/* Chat panel - slides in for hint/ask mode */}
          <AnimatePresence>
            {mode === 'hint' && isChatOpen && (
              <ChatSlidePanel onClose={() => setIsChatOpen(false)}>{chatContent}</ChatSlidePanel>
            )}
          </AnimatePresence>
        </div>

        {/* Test mode timer */}
        <AnimatePresence>
          {mode === 'test' && <TestModeTimer className="fixed top-20 end-4 z-50" />}
        </AnimatePresence>

        {/* Mobile bottom sheet trigger */}
        {isMobile && <MobileNavTrigger />}
      </div>
    </TestModeGuard>
  )
}

/**
 * Mobile navigation trigger (placeholder for bottom sheet)
 */
function MobileNavTrigger() {
  const { setIsChatOpen, mode } = useStudyMode()

  return (
    <div className="md:hidden fixed bottom-4 end-4 flex gap-2 z-50">
      {/* Chat button - only in hint mode */}
      {mode === 'hint' && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="w-14 h-14 rounded-full bg-mode-accent text-mode-accent-fg flex items-center justify-center shadow-lg"
          aria-label="Open chat"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Main workspace component with provider wrapper
 */
export function StudyingWorkspace(props: StudyingWorkspaceProps) {
  return (
    <StudyModeProvider>
      <StudyingWorkspaceInner {...props} />
    </StudyModeProvider>
  )
}
