'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { usePathname } from 'next/navigation'
import React from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import { SplitPaneLayout } from '@/ui/web/components/split-pane-layout'
import { FloatingAskButton } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  primaryContent: React.ReactNode
  chatContent?: React.ReactNode
  /** Course ID for chat context */
  courseId?: string
  /** Lesson ID for chat context */
  lessonId?: string
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  primaryContent,
  chatContent,
  courseId,
  lessonId,
}: ExerciseWorkspaceProps) {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const pathname = usePathname()

  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

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
      <SplitPaneLayout
        primaryContent={primaryContent}
        chatContent={chatContent}
        storageKey="exercise-split-size"
        className="flex-1"
      />
      {/* Floating Ask Button - visible at bottom-left during exercises */}
      <FloatingAskButton isCentered={false} courseId={courseId} lessonId={lessonId} />
    </div>
  )
}
