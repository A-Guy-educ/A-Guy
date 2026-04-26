'use client'

import React from 'react'

import ContentCountsWidget from './ContentCountsWidget'
import DashboardHeader from './DashboardHeader'
import EngagementWidget from './EngagementWidget'
import MetricsProvider from './MetricsProvider'
import UserMetricsWidget from './UserMetricsWidget'

const DashboardWidgets: React.FC = () => {
  return (
    <MetricsProvider>
      <DashboardHeader />
      <UserMetricsWidget />
      <ContentCountsWidget />
      <EngagementWidget />
    </MetricsProvider>
  )
}

export default DashboardWidgets
