'use client'

import type { User } from '@/payload-types'
import { useCallback, useEffect, useState } from 'react'

interface UseCurrentUserReturn {
  user: User | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async (controller?: AbortController) => {
    setIsLoading(true)
    setError(null)
    try {
      // When called from the mount effect, pass the controller for shared timeout + cleanup.
      // When called from the auth-change handler (no arg), create a local one for timeout only.
      const localController = new AbortController()
      const activeController = controller ?? localController
      const timeoutId = setTimeout(() => activeController.abort(), 15000)
      const response = await fetch('/api/users/me', {
        credentials: 'include',
        cache: 'no-store',
        signal: activeController.signal,
      })
      clearTimeout(timeoutId)
      if (response.ok) {
        const data = await response.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch (err) {
      // Ignore AbortError (timeout / unmount) — leave user as null, exit loading
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    const controller = new AbortController()
    fetchUser(controller)
    return () => controller.abort()
  }, [fetchUser])

  // Listen for auth changes (login/logout)
  useEffect(() => {
    const handleAuthChange = () => fetchUser()
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [fetchUser])

  return { user, isLoading, error, refetch: fetchUser }
}
