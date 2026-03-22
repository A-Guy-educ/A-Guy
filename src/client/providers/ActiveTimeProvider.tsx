/**
 * Active Time Provider
 *
 * Client-side provider that wraps the app to track active time.
 * Also provides current lesson context for per-lesson time tracking.
 */

'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { useActiveTimeTracker } from '@/client/hooks/useActiveTimeTracker'

interface ActiveTimeContextValue {
  setCurrentLesson: (lessonId: string | null) => void
  currentLessonId: string | null
}

const ActiveTimeContext = createContext<ActiveTimeContextValue>({
  setCurrentLesson: () => {},
  currentLessonId: null,
})

export function useSetCurrentLesson(lessonId: string | null) {
  const { setCurrentLesson } = useContext(ActiveTimeContext)

  useEffect(() => {
    setCurrentLesson(lessonId)
    return () => setCurrentLesson(null)
  }, [lessonId, setCurrentLesson])
}

interface ActiveTimeProviderProps {
  children: React.ReactNode
}

export function ActiveTimeProvider({ children }: ActiveTimeProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null)
  const lessonIdRef = useRef<string | null>(null)

  // Keep ref in sync for the heartbeat callback
  lessonIdRef.current = currentLessonId

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setIsAuthenticated(!!data.user)
        }
      } catch {
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  useActiveTimeTracker({
    isAuthenticated,
    enabled: isAuthenticated,
    getLessonId: () => lessonIdRef.current,
  })

  const setCurrentLesson = useCallback((lessonId: string | null) => {
    setCurrentLessonId(lessonId)
  }, [])

  return (
    <ActiveTimeContext.Provider value={{ setCurrentLesson, currentLessonId }}>
      {children}
    </ActiveTimeContext.Provider>
  )
}
