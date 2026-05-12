'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type {
  PaymentDashboardResponse,
  PaymentPeriod,
} from '@/app/api/admin/payments/dashboard-metrics/route'

interface PaymentMetricsContextValue {
  data: PaymentDashboardResponse | null
  loading: boolean
  error: string | null
  period: PaymentPeriod
  setPeriod: (p: PaymentPeriod) => void
}

const PaymentMetricsContext = createContext<PaymentMetricsContextValue | null>(null)

export function usePaymentMetricsContext(): PaymentMetricsContextValue {
  const ctx = useContext(PaymentMetricsContext)
  if (!ctx) {
    throw new Error('usePaymentMetricsContext must be used within PaymentMetricsProvider')
  }
  return ctx
}

const PaymentMetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<PaymentDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PaymentPeriod>('month')

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/payments/dashboard-metrics?period=${period}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 403) {
          setError('admin-only')
          return
        }
        throw new Error(`Failed to fetch metrics: ${res.status}`)
      }
      const json = (await res.json()) as PaymentDashboardResponse
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
    <PaymentMetricsContext.Provider value={{ data, loading, error, period, setPeriod }}>
      {children}
    </PaymentMetricsContext.Provider>
  )
}

export default PaymentMetricsProvider
