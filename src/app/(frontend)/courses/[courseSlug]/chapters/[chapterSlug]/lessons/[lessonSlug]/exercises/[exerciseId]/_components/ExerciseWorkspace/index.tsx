'use client'

import { ResizablePane } from '@/components/ui/resizable-pane'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import React, { useCallback, useEffect, useState } from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import { MobileMenu } from '@/Header/MobileMenu'
import type { Header as HeaderType, User } from '@/payload-types'

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [headerData, setHeaderData] = useState<HeaderType | null>(null)

  // Fetch user on client side
  const fetchUser = useCallback(async () => {
    setIsAuthLoading(true)
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include',
        cache: 'no-store',
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch (_error) {
      setUser(null)
    } finally {
      setIsAuthLoading(false)
    }
  }, [])

  // Fetch header data and user on mount
  useEffect(() => {
    fetchUser()

    // Fetch header data
    fetch('/api/globals/header')
      .then((res) => res.json())
      .then((data) => setHeaderData(data))
      .catch(() => setHeaderData(null))
  }, [fetchUser])

  // Listen for auth changes
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
        onMenuClick={() => setIsMobileMenuOpen(true)}
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

      {/* Mobile Menu */}
      {headerData && (
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          data={headerData}
          user={user}
          isAuthLoading={isAuthLoading}
        />
      )}
    </div>
  )
}
