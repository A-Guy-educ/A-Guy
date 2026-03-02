/**
 * Server-side system locale resolution
 *
 * Reads the system language (UI i18n) from middleware header or cookie.
 * Shared between layout.tsx and any server component that needs the system locale.
 */
import { headers, cookies } from 'next/headers'
import { cookieName, defaultLocale, type Locale, locales } from '@/i18n/config'

export async function getSystemLocale(): Promise<Locale> {
  const headersList = await headers()
  const headerLocale = headersList.get('x-locale') as Locale | null
  if (headerLocale && locales.includes(headerLocale)) return headerLocale

  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(cookieName)?.value as Locale | undefined
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale

  return defaultLocale
}
