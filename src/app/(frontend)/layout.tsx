import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Assistant } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Toaster } from '@/components/ui/toaster'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { I18nProvider } from '@/providers/I18n'
import { defaultLocale, cookieName, type Locale, locales } from '@/i18n/config'
import { headers, cookies } from 'next/headers'

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
    return (await import(`../../../messages/${locale}.json`)).default
  } catch {
    return (await import(`../../../messages/${defaultLocale}.json`)).default
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Draft mode is handled in individual pages/components, not in the layout
  // This avoids static-to-dynamic conversion errors
  const isEnabled = false

  const locale = await getLocale()
  const messages = await getMessages(locale)

  // Determine text direction based on locale
  const dir = locale === 'he' ? 'rtl' : 'ltr'

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
