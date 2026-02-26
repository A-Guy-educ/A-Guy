/**
 * @fileType layout
 * @domain cody
 * @pattern route-group
 * @ai-summary Root layout for Cody dashboard - uses frontend styles with CopilotKit
 */
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { InitTheme } from '@/ui/web/providers/Theme/InitTheme'
import '@/app/(frontend)/globals.css'

function MakeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return MakeQueryClient()
  } else {
    if (!browserQueryClient) browserQueryClient = MakeQueryClient()
    return browserQueryClient
  }
}

export default function CodyLayout({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <InitTheme />
          <link href="/favicon.ico" rel="icon" sizes="32x32" />
        </head>
        <body className="min-h-screen bg-background text-foreground">{children}</body>
      </html>
    </QueryClientProvider>
  )
}
