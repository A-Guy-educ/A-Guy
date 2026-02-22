/**
 * @fileType layout
 * @domain cody
 * @pattern route-group
 * @ai-summary Root layout for Cody dashboard with CopilotKit provider
 */
import type { Metadata } from 'next'

import { CopilotKit } from '@copilotkit/react-core'
import '@copilotkit/react-ui/styles.css'

export const metadata: Metadata = {
  title: 'Cody Operations Dashboard',
  description: 'Developer operations dashboard for monitoring Cody CI build agent',
}

export default function CodyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
      </head>
      <body>
        <CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>
      </body>
    </html>
  )
}
