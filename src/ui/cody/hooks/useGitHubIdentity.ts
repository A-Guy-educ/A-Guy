/**
 * @fileType hook
 * @domain cody
 * @pattern github-identity
 * @ai-summary Hook to read the authenticated GitHub identity from the Cody session cookie.
 *   Replaces the localStorage-based "Who are you?" picker with verified GitHub OAuth identity.
 *   The session is set server-side by /api/oauth/github/callback.
 *   clearGitHubUser() logs out (clears session cookie) and redirects to GitHub OAuth.
 */
'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface GitHubIdentity {
  login: string
  avatar_url: string
  githubId?: number
}

interface MeResponse {
  authenticated: boolean
  user?: GitHubIdentity
}

const QUERY_KEY = ['cody-github-identity']

async function fetchIdentity(): Promise<GitHubIdentity | null> {
  const res = await fetch('/api/cody/auth/me', { credentials: 'include' })
  if (!res.ok) return null
  const data = (await res.json()) as MeResponse
  return data.authenticated && data.user ? data.user : null
}

/**
 * Returns the verified GitHub identity from the Cody session.
 *
 * - `githubUser` is `null` when not authenticated (session missing or expired).
 * - `isLoaded` is `false` while the initial fetch is in progress.
 * - `setGitHubUser` is a no-op (identity is set by OAuth, not manually).
 * - `clearGitHubUser()` clears the session and redirects to GitHub OAuth login.
 */
export function useGitHubIdentity() {
  const queryClient = useQueryClient()

  const { data: githubUser = null, isLoading } = useQuery<GitHubIdentity | null>({
    queryKey: QUERY_KEY,
    queryFn: fetchIdentity,
    staleTime: 5 * 60 * 1000, // 5 minutes — session is stable within a visit
    retry: false,
  })

  const isLoaded = !isLoading

  // No-op: identity is set by OAuth flow, not manually
  const setGitHubUser = useCallback(() => {
    // Identity is managed by OAuth session — use clearGitHubUser() to re-auth
  }, [])

  const clearGitHubUser = useCallback(async () => {
    // Clear session cookie server-side
    try {
      await fetch('/api/cody/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Ignore — we'll redirect anyway
    }
    // Invalidate cached identity
    queryClient.setQueryData(QUERY_KEY, null)
    // Redirect to GitHub OAuth
    window.location.href = '/api/oauth/github?returnTo=/cody'
  }, [queryClient])

  return { githubUser, isLoaded, setGitHubUser, clearGitHubUser }
}
