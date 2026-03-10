'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { StudyMode, ChatPolicy, StudyModeContextValue } from './types'

/**
 * @fileType context-provider
 * @domain study-mode
 * @pattern context-provider
 * @ai-summary Context provider for study mode state with URL sync
 */

export const StudyModeContext = createContext<StudyModeContextValue | null>(null)

interface StudyModeProviderProps {
  children: React.ReactNode
  defaultMode?: StudyMode
}

/**
 * Provider component that manages study mode state and syncs with URL
 */
export function StudyModeProvider({ children, defaultMode = 'study' }: StudyModeProviderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setModeState] = useState<StudyMode>(() => {
    const urlMode = searchParams.get('mode') as StudyMode | null
    return urlMode && ['study', 'hint', 'practice', 'test'].includes(urlMode)
      ? urlMode
      : defaultMode
  })
  const [previousMode, setPreviousMode] = useState<StudyMode | null>(null)
  const [chatPolicy, setChatPolicy] = useState<ChatPolicy>('hint')
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Track if we should sync to URL (avoid infinite loops)
  const isInitialMount = useRef(true)

  // Update URL when mode changes
  const setMode = useCallback(
    (newMode: StudyMode) => {
      setPreviousMode(mode)
      setModeState(newMode)

      // Update URL without full reload
      const params = new URLSearchParams(searchParams.toString())
      params.set('mode', newMode)

      // Use router.replace to avoid adding to history stack for each mode change
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [mode, router, searchParams],
  )

  // Set data-study-mode attribute on mount and mode change
  useEffect(() => {
    // Skip initial mount to avoid overwriting
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Apply mode to the document for CSS custom properties
    document.body.setAttribute('data-study-mode', mode)

    return () => {
      document.body.removeAttribute('data-study-mode')
    }
  }, [mode])

  const value = useMemo<StudyModeContextValue>(
    () => ({
      mode,
      previousMode,
      setMode,
      chatPolicy,
      setChatPolicy,
      isChatOpen,
      setIsChatOpen,
    }),
    [mode, previousMode, setMode, chatPolicy, isChatOpen],
  )

  return <StudyModeContext.Provider value={value}>{children}</StudyModeContext.Provider>
}

/**
 * Hook to access study mode context
 */
export function useStudyMode() {
  const context = useContext(StudyModeContext)

  if (!context) {
    throw new Error('useStudyMode must be used within a StudyModeProvider')
  }

  return context
}
