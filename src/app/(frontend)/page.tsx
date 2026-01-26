import { cookieName, defaultLocale, locales, type Locale } from '@/i18n/config'
import { queryPageBySlug } from '@/server/repos/queries/pages'
import { RenderHero } from '@/ui/web/heros/RenderHero'
import { PayloadRedirects } from '@/ui/web/PayloadRedirects'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'

export default async function HomepagePage() {
  // Run redirects first - if no redirect applies, we'll fall through
  const redirects = await import('@/infra/utils/getRedirects').then((m) => m.getCachedRedirects()())
  const redirectItem = redirects.find((r) => normalizeAndMatch(r.from, '/'))

  if (redirectItem) {
    // Redirects will be handled by PayloadRedirects component
  } else {
    // No redirect, load home page from Pages collection
    const homePage = await queryPageBySlug({ slug: 'home' })

    if (!homePage) {
      // Fall back to /start if no home page
      const { redirect } = await import('next/navigation')
      redirect('/start')
    }

    // Render the home page with hero and layout
    const { hero } = homePage
    if (hero) {
      return <RenderHero {...hero} />
    }
  }

  // Fall through to PayloadRedirects which will handle redirects or notFound
  return <PayloadRedirects disableNotFound url="/" />
}

function normalizeAndMatch(redirectFrom: string, url: string): boolean {
  const normalize = (input: string): string => {
    let path = input.trim()

    // Strip query string
    const queryIndex = path.indexOf('?')
    if (queryIndex !== -1) {
      path = path.slice(0, queryIndex)
    }

    // Strip hash
    const hashIndex = path.indexOf('#')
    if (hashIndex !== -1) {
      path = path.slice(0, hashIndex)
    }

    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path
    }

    // Remove trailing slash (except for root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }

    return path
  }

  return normalize(redirectFrom) === normalize(url)
}

async function getLocale(): Promise<string> {
  const headersList = await headers()
  const cookieStore = await cookies()

  const headerLocale = headersList.get('x-locale')
  if (headerLocale && locales.includes(headerLocale as Locale)) {
    return headerLocale
  }

  const cookieLocale = cookieStore.get(cookieName)?.value
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale
  }

  return defaultLocale
}

async function getMessages(locale: string) {
  try {
    return (await import(`../../../src/i18n/${locale}.json`, { with: { type: 'json' } })).default
  } catch {
    return (await import(`../../../src/i18n/${defaultLocale}.json`, { with: { type: 'json' } }))
      .default
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const messages = await getMessages(locale)

  const t = (key: string) => {
    const keys = key.split('.')
    let value: unknown = messages
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k]
      if (value === undefined) break
    }
    return (value as string) || key
  }

  // First check for redirects
  const redirects = await import('@/infra/utils/getRedirects').then((m) => m.getCachedRedirects()())
  const redirectItem = redirects.find((r) => normalizeAndMatch(r.from, '/'))

  // If there's a redirect, use default metadata
  if (redirectItem) {
    return {
      title: t('home.title'),
      description: t('home.description'),
    }
  }

  // Load home page from Pages collection
  const homePage = await queryPageBySlug({ slug: 'home' })

  if (!homePage) {
    return {
      title: t('home.title'),
      description: t('home.description'),
    }
  }

  const { title, meta } = homePage

  return {
    title: meta?.title || title || t('home.title'),
    description: meta?.description || t('home.description'),
  }
}
