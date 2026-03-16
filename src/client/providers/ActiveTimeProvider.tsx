/**
 * Active Time Provider
 *
 * Client-side provider that wraps the app to track active time.
 * Automatically checks authentication status.
 */

'use client'

import { useActiveTimeTracker } from '@/client/hooks/useActiveTimeTracker'
import { useEffect, useState } from 'react'

interface ActiveTimeProviderProps {
  children: React.ReactNode
}

export function ActiveTimeProvider({ children }: ActiveTimeProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check authentication status on mount
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
  })

  return <>{children}</>
}
