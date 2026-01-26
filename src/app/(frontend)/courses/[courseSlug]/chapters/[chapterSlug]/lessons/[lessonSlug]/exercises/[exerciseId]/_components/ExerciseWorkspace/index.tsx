'use client'

import type { User } from '@/payload-types'
import { useMediaQuery } from '@/server/payload/hooks/useMediaQuery'
import { ResizablePane } from '@/ui/web/components/resizable-pane'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
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
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // Trigger the existing mobile menu from the main header
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  // Fetch user on client side to avoid static-to-dynamic conversion
  const fetchUser = useCallback(async () => {
    setIsAuthLoading(true)
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include', // Include cookies
        cache: 'no-store',
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch (_error) {
      // Silently fail - user is not authenticated
      setUser(null)
    } finally {
      setIsAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    const handleAuthChange = () => {
      fetchUser()
    }

    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [fetchUser])

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
