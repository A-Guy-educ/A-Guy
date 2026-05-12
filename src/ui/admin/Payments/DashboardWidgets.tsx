'use client'

import React from 'react'

import PaymentHeader from './PaymentHeader'
import PaymentMetricsProvider from './PaymentMetricsProvider'
import PaymentStatsWidget from './PaymentStatsWidget'
import RevenueWidget from './RevenueWidget'

const DashboardWidgets: React.FC = () => {
  return (
    <PaymentMetricsProvider>
      <PaymentHeader />
      <RevenueWidget />
      <PaymentStatsWidget />
    </PaymentMetricsProvider>
  )
}

export default DashboardWidgets
