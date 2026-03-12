'use client'

import type { User } from '@/payload-types'
import { useCallback, useEffect, useState } from 'react'
import { useUserContext } from '@/client/providers/UserProvider'

interface UseCurrentUserReturn {
  user: User | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to access the current user.
 * When rendered inside a UserProvider (frontend layout), shares a single
 * /api/users/me fetch across all consumers.
 * When rendered outside (e.g. Payload admin pages), falls back to its own fetch.
 */
export function useCurrentUser(): UseCurrentUserReturn {
  const shared = useUserContext()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    setIsLoading(true)
    setError(null)
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Only fetch independently when no provider is available
  useEffect(() => {
    if (!shared) {
      fetchUser()
    }
  }, [shared, fetchUser])

  useEffect(() => {
    if (!shared) {
      const handleAuthChange = () => fetchUser()
      window.addEventListener('auth:changed', handleAuthChange)
      return () => window.removeEventListener('auth:changed', handleAuthChange)
    }
  }, [shared, fetchUser])

  if (shared) {
    return shared
  }

  return { user, isLoading, error, refetch: fetchUser }
}
