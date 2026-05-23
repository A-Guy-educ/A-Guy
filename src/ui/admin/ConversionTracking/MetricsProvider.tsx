'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type { DashboardMetricsResponse, Period } from '@/app/api/admin/dashboard-metrics/route'

interface MetricsContextValue {
  data: DashboardMetricsResponse | null
  loading: boolean
  error: string | null
  period: Period
  setPeriod: (p: Period) => void
}

const MetricsContext = createContext<MetricsContextValue | null>(null)

export function useMetricsContext(): MetricsContextValue {
  const ctx = useContext(MetricsContext)
  if (!ctx) {
    throw new Error('useMetricsContext must be used within MetricsProvider')
  }
  return ctx
}

const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DashboardMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('month')

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const TIMEOUT_MS = 30_000
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`/api/admin/dashboard-metrics?period=${period}`, {
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        if (res.status === 403) {
          setError('admin-only')
          return
        }
        throw new Error(`Failed to fetch metrics: ${res.status}`)
      }
      const json = (await res.json()) as DashboardMetricsResponse
      setData(json)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('timeout')
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void fetchMetrics()
  }, [fetchMetrics])

  return (
    <MetricsContext.Provider value={{ data, loading, error, period, setPeriod }}>
      {children}
    </MetricsContext.Provider>
  )
}

export default MetricsProvider
