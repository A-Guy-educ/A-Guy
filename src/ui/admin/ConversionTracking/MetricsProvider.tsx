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
    try {
      const res = await fetch(`/api/admin/dashboard-metrics?period=${period}`, {
        credentials: 'include',
      })
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
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
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
