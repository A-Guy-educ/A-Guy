/**
 * @fileType hook
 * @domain cody
 * @pattern github-identity
 * @ai-summary Hook to read/write the selected GitHub identity from localStorage
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GitHubCollaborator } from '../types'

const STORAGE_KEY = 'cody:github-user'

export interface GitHubIdentity {
  login: string
  avatar_url: string
}

/**
 * Reads/writes the selected GitHub user from localStorage.
 *
 * - `githubUser` is `null` until a user is selected (or on first render before hydration).
 * - `isLoaded` is `false` during SSR / first render; `true` once localStorage has been read.
 * - `setGitHubUser(user)` persists the choice immediately.
 * - `clearGitHubUser()` removes the stored identity (allows re-picking).
 */
export function useGitHubIdentity() {
  const [githubUser, setUser] = useState<GitHubIdentity | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Read from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as GitHubIdentity
        if (parsed.login && parsed.avatar_url) {
          setUser(parsed)
        }
      }
    } catch {
      // Corrupted value — ignore
    }
    setIsLoaded(true)
  }, [])

  const setGitHubUser = useCallback((user: GitHubCollaborator) => {
    const identity: GitHubIdentity = { login: user.login, avatar_url: user.avatar_url }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
    setUser(identity)
  }, [])

  const clearGitHubUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  return { githubUser, isLoaded, setGitHubUser, clearGitHubUser }
}
