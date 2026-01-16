import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { AnalyticsProvider } from '@/lib/analytics/providers/AnalyticsProvider'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AnalyticsProvider>
        <HeaderThemeProvider>{children}</HeaderThemeProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  )
}
