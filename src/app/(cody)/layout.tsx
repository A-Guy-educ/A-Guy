/**
 * @fileType layout
 * @domain cody
 * @pattern route-group
 * @ai-summary Root layout for Cody dashboard - uses frontend styles with CopilotKit
 */
import type { Metadata } from 'next'

import { InitTheme } from '@/ui/web/providers/Theme/InitTheme'
import '@/app/(frontend)/globals.css'
import '@copilotkit/react-ui/styles.css'

export const metadata: Metadata = {
  title: 'Cody Operations Dashboard',
  description: 'Developer operations dashboard for monitoring Cody CI build agent',
}

export default function CodyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
      </head>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  )
}
