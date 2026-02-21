import type { Metadata } from 'next'

import '../(frontend)/globals.css'
import '@copilotkit/react-ui/styles.css'

export const metadata: Metadata = {
  title: 'Cody',
  description: 'AI Assistant Dashboard',
}

export default function CodyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
