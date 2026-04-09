import type { Metadata } from 'next'

import { cn } from '@/infra/utils/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Assistant, STIX_Two_Text } from 'next/font/google'
import React from 'react'

import { loadConfigValues } from '@/infra/config/runtime'
import { isPasswordLoginEnabled } from '@/infra/config/system-params'
import { mergeOpenGraph } from '@/infra/utils/mergeOpenGraph'
import { AdminBar } from '@/ui/web/AdminBar'
import { Toaster } from '@/ui/web/components/toaster'
import { Footer } from '@/ui/web/footer/Component'
import { Header } from '@/ui/web/header/Component'
import { Providers } from '@/ui/web/providers'
import { PasswordLoginProvider } from '@/ui/web/providers/PasswordLoginProvider'
import { InitTheme } from '@/ui/web/providers/Theme/InitTheme'
import { RouteLoadingIndicator } from '@/infra/loading/components/RouteLoadingIndicator'

import { defaultLocale, getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { getPayload } from 'payload'
import config from '@payload-config'
import './globals.css'
import { LayoutClient } from './LayoutClient'
import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { ActiveTimeProvider } from '@/client/providers/ActiveTimeProvider'

const assistant = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-assistant',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  variable: '--font-stix-two-text',
  display: 'swap',
})

async function getMessages(locale: string) {
  try {
    return (await import(`../../../src/i18n/${locale}.json`, { with: { type: 'json' } })).default
  } catch {
    return (await import(`../../../src/i18n/${defaultLocale}.json`, { with: { type: 'json' } }))
      .default
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Draft mode is handled in individual pages/components, not in the layout
  // This avoids static-to-dynamic conversion errors
  const isEnabled = false

  const locale = await getSystemLocale()
  const messages = await getMessages(locale)
  const dir = getDirection(locale)

  const payload = await getPayload({ config })
  // loadConfigValues is idempotent — returns cached data on repeat calls.
  // This runs once per serverless instance (not per request) because the
  // module-level cache in config-values.ts survives across requests.
  await loadConfigValues(payload)
  const passwordLoginEnabled = await isPasswordLoginEnabled()

  return (
    <html
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        assistant.variable,
        stixTwoText.variable,
      )}
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
            <ActiveTimeProvider>
              <PasswordLoginProvider enabled={passwordLoginEnabled}>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-elevation-3"
                >
                  Skip to content
                </a>
                <RouteLoadingIndicator />
                <LayoutClient />
                <AdminBar
                  adminBarProps={{
                    preview: isEnabled,
                  }}
                />
                <Header />
                <NavigationBar />
                <div id="main-content" className="flex-1">
                  {children}
                </div>
                <Footer />
                <Toaster />
              </PasswordLoginProvider>
            </ActiveTimeProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.aguy.co.il'),
  manifest: '/manifest.json',
  title: {
    default: 'A-Guy | תרגול מתמטיקה אינטראקטיבי',
    template: '%s | A-Guy',
  },
  description:
    'פלטפורמה לתרגול מתמטיקה עם שיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים ברורים שלב אחר שלב – בנויה להתקדמות עקבית ואמיתית.',
  keywords: [],
  authors: [{ name: 'A-Guy', url: 'https://www.aguy.co.il' }],
  creator: 'A-Guy',
  publisher: 'A-Guy',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'A-Guy',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#91262C' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    site: '@aguy',
    creator: '@aguy',
    title: 'A-Guy | תרגול מתמטיקה אינטראקטיבי',
    description:
      'פלטפורמה לתרגול מתמטיקה עם שיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים ברורים שלב אחר שלב.',
    images: [
      {
        url: 'https://www.aguy.co.il/api/media/file/telescope.4ee60378.svg',
        width: 1200,
        height: 630,
        alt: 'A-Guy - תרגול מתמטיקה אינטראקטיבי',
      },
    ],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.ico',
    apple: '/favicon.svg',
  },
}
