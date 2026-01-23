import type { Metadata } from 'next'

import { cn } from '@/infra/utils/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Assistant } from 'next/font/google'
import React from 'react'

import { Footer } from '@/ui/web/footer/Component'
import { Header } from '@/ui/web/header/Component'
import { Providers } from '@/ui/providers'
import { InitTheme } from '@/ui/providers/Theme/InitTheme'
import { Toaster } from '@/ui/ui/toaster'
import { AdminBar } from '@/ui/web/AdminBar'
import { mergeOpenGraph } from '@/infra/utils/mergeOpenGraph'

import { cookieName, defaultLocale, getDirection, type Locale, locales } from '@/i18n/config'
import { I18nProvider } from '@/ui/providers/I18n'
import { getServerSideURL } from '@/infra/utils/getURL'
import { cookies, headers } from 'next/headers'
import './globals.css'
import { LayoutClient } from './LayoutClient'

const assistant = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-assistant',
})

// Read locale from middleware header or cookie
// Middleware sets x-locale header after detecting locale from cookie/subdomain
async function getLocale(): Promise<Locale> {
  const headersList = await headers()
  const cookieStore = await cookies()

  // First, try to read from middleware header
  const headerLocale = headersList.get('x-locale') as Locale | null
  if (headerLocale && locales.includes(headerLocale)) {
    return headerLocale
  }

  // Fallback to cookie (in case header is not set)
  const cookieLocale = cookieStore.get(cookieName)?.value as Locale | undefined
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale
  }

  // Default fallback
  return defaultLocale
}

async function getMessages(locale: string) {
  try {
    return (await import(`../../../messages/${locale}.json`, { with: { type: 'json' } })).default
  } catch {
    return (await import(`../../../messages/${defaultLocale}.json`, { with: { type: 'json' } }))
      .default
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Draft mode is handled in individual pages/components, not in the layout
  // This avoids static-to-dynamic conversion errors
  const isEnabled = false

  const locale = await getLocale()
  const messages = await getMessages(locale)

  // Determine text direction based on locale
  const dir = getDirection(locale)

  return (
    <html
      className={cn(GeistSans.variable, GeistMono.variable, assistant.variable)}
      dir={dir}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <Providers>
            <LayoutClient />
            <AdminBar
              adminBarProps={{
                preview: isEnabled,
              }}
            />
            <Header />
            {children}
            <Footer />
            <Toaster />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
