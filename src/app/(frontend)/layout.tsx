import type { Metadata } from 'next'

import { cn } from '@/infra/utils/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Assistant } from 'next/font/google'
import React, { Suspense } from 'react'

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

import { defaultLocale, getDirection, locales } from '@/i18n/config'
import { I18nProvider } from '@/ui/web/providers/I18n'
import { getPayload } from 'payload'
import config from '@payload-config'
import './globals.css'
import { LayoutClient } from './LayoutClient'

const assistant = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-assistant',
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAllMessages(): Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {}
  for (const locale of locales) {
    try {
      result[locale] = (
        await import(`../../../src/i18n/${locale}.json`, { with: { type: 'json' } })
      ).default
    } catch {
      // Skip locales with missing files
    }
  }
  return result
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Draft mode is handled in individual pages/components, not in the layout
  // This avoids static-to-dynamic conversion errors
  const isEnabled = false

  // Use defaultLocale for server render — client-side I18nProvider reads the
  // NEXT_LOCALE cookie and updates <html lang/dir> on hydration.
  // This avoids calling cookies()/headers() which would force every page to
  // be dynamically rendered on every request.
  const dir = getDirection(defaultLocale)

  const allMessages = await getAllMessages()

  const payload = await getPayload({ config })
  await loadConfigValues(payload)
  const passwordLoginEnabled = await isPasswordLoginEnabled()

  return (
    <html
      className={cn(GeistSans.variable, GeistMono.variable, assistant.variable)}
      dir={dir}
      lang={defaultLocale}
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <I18nProvider allMessages={allMessages}>
          <Providers>
            <PasswordLoginProvider enabled={passwordLoginEnabled}>
              <Suspense fallback={null}>
                <RouteLoadingIndicator />
              </Suspense>
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
            </PasswordLoginProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.aguy.co.il'),
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
    apple: '/apple-touch-icon.png',
  },
  other: {
    'theme-color': '#0f172a',
  },
}
