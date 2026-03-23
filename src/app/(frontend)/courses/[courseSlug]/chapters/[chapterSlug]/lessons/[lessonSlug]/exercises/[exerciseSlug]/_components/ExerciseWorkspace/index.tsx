'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { usePathname } from 'next/navigation'
import React from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import { SplitPaneLayout } from '@/ui/web/components/split-pane-layout'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  primaryContent: React.ReactNode
  chatContent: React.ReactNode
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  primaryContent,
  chatContent,
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
    </div>
  )
}
