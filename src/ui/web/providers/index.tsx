import React, { Suspense } from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { AnalyticsProvider } from '@/infra/analytics/providers/AnalyticsProvider'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <AnalyticsProvider>
          <HeaderThemeProvider>{children}</HeaderThemeProvider>
        </AnalyticsProvider>
      </Suspense>
    </ThemeProvider>
  )
}
