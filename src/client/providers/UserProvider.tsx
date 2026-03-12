'use client'

import type { User } from '@/payload-types'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface UserContextValue {
  user: User | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
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

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    const handleAuthChange = () => fetchUser()
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [fetchUser])

  return (
    <UserContext.Provider value={{ user, isLoading, error, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

/**
 * Returns the UserContext value, or null if no provider is mounted.
 * Callers outside the frontend layout (e.g. Payload admin pages) get null.
 */
export function useUserContext(): UserContextValue | null {
  return useContext(UserContext)
}
