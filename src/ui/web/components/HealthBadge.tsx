'use client'

import { useEffect, useState } from 'react'

interface HealthResponse {
  ok: boolean
  gitSha: string
  payloadVersion: string
  projectVersion: string
  timestamp: string
}

interface HealthBadgeProps {
  showVersion?: boolean
}

type BadgeState = 'loading' | 'healthy' | 'unhealthy' | 'error'

export function HealthBadge({ showVersion = false }: HealthBadgeProps) {
  const [state, setState] = useState<BadgeState>('loading')
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
        const json = (await response.json()) as HealthResponse

        if (response.ok && json.ok) {
          setData(json)
          setState('healthy')
        } else {
          setError(json.ok === false ? 'API returned unhealthy status' : 'Unexpected response')
          setState('unhealthy')
        }
      } catch (err) {
        // Ignore AbortError - component unmounted
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setError('Failed to fetch health status')
        setState('error')
      }
    }

    checkHealth()

    return () => {
      controller.abort()
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
        <span className="animate-pulse">●</span>
        <span>Checking API...</span>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-sm">
        <span>●</span>
        <span>API ERROR</span>
      </div>
    )
  }

  if (state === 'unhealthy') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-sm">
        <span>●</span>
        <span>API DOWN</span>
        {error && <span className="text-xs opacity-75">({error})</span>}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-sm">
      <span>●</span>
      <span>API OK</span>
      {showVersion && data && (
        <span className="text-xs opacity-75 ml-2">
          {data.projectVersion} ({data.gitSha.slice(0, 7)})
        </span>
      )}
    </div>
  )
}
