'use client'

import React from 'react'

import RevenueWidget from '@/ui/admin/RevenueWidget'
import RecentTransactionsWidget from '@/ui/admin/RecentTransactionsWidget'
import TopProductsWidget from '@/ui/admin/TopProductsWidget'
import CourseEnrollmentsWidget from '@/ui/admin/CourseEnrollmentsWidget'
import ContentCountsWidget from './ContentCountsWidget'
import DashboardHeader from './DashboardHeader'
import EngagementWidget from './EngagementWidget'
import MetricsProvider from './MetricsProvider'
import UserMetricsWidget from './UserMetricsWidget'

const DashboardWidgets: React.FC = () => {
  return (
    <MetricsProvider>
      <DashboardHeader />
      <RevenueWidget />
      <TopProductsWidget />
      <CourseEnrollmentsWidget />
      <RecentTransactionsWidget />
      <UserMetricsWidget />
      <ContentCountsWidget />
      <EngagementWidget />
    </MetricsProvider>
  )
}

export default DashboardWidgets
