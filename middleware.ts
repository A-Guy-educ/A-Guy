import { NextRequest, NextResponse } from 'next/server'
import {
  cookieName,
  defaultLocale,
  type Locale,
  locales,
  getLocaleFromSubdomain,
} from './src/i18n/config'

function resolveCookieDomain(host: string): string | undefined {
  // If you're on *.vercel.app, sharing cookies across subdomains via Domain=.vercel.app
  // is typically blocked (public suffix). In that case, keep host-only cookie.
  if (host.endsWith('.vercel.app')) return undefined

  // Prefer explicit root domain if you set it (recommended)
  // e.g. ROOT_DOMAIN=example.com -> cookie domain ".example.com"
  const rootFromEnv = process.env.ROOT_DOMAIN?.trim()
  if (rootFromEnv) return `.${rootFromEnv.replace(/^\./, '')}`

  // Fallback: naive "apex" extraction (works for most .com/.net/.org cases)
  const parts = host.split(':')[0].split('.').filter(Boolean)
  if (parts.length < 2) return undefined
  const apex = parts.slice(-2).join('.')
  return `.${apex}`
}

/**
 * Extensions that must stay proxied through the API (same-origin requirement).
 * PDF.js viewer requires same-origin URLs to render documents.
 */
const PROXY_ONLY_EXTENSIONS = new Set(['.pdf'])

/**
 * Extract the Vercel Blob public base URL from the BLOB_READ_WRITE_TOKEN.
 * Token format: vercel_blob_rw_{storeId}_{random}
 * Public URL:   https://{storeId}.public.blob.vercel-storage.com
 */
function getBlobBaseUrl(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return null
  const match = token.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)
  if (!match) return null
  return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`
}

/**
 * Map of collection slug to Blob storage prefix.
 * Must match the prefixes used by @payloadcms/storage-vercel-blob.
 * The plugin defaults to the collection slug as prefix.
 */
const COLLECTION_PREFIX: Record<string, string> = {
  media: 'media',
  'exercise-assets': 'exercise-assets',
}

/**
 * Redirect media file requests directly to Vercel Blob CDN instead of
 * proxying through a serverless function. This eliminates the main
 * bottleneck causing multi-second (or minute-long) media load times.
 *
 * Handles two URL patterns:
 *   /api/media/file/{filename}           → collection "media"
 *   /api/exercise-assets/file/{filename}  → collection "exercise-assets"
 */
function handleMediaRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl

  // Match /api/{collection}/file/{filename}
  let collectionSlug: string | null = null
  let filename: string | null = null

  if (pathname.startsWith('/api/media/file/')) {
    collectionSlug = 'media'
    filename = pathname.slice('/api/media/file/'.length)
  } else if (pathname.startsWith('/api/exercise-assets/file/')) {
    collectionSlug = 'exercise-assets'
    filename = pathname.slice('/api/exercise-assets/file/'.length)
  }

  if (!collectionSlug || !filename) return null

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (PROXY_ONLY_EXTENSIONS.has(ext)) return null

  const blobBaseUrl = getBlobBaseUrl()
  if (!blobBaseUrl) return null

  // Build the Blob URL with the collection prefix, matching the plugin's storage path:
  //   {baseUrl}/{prefix}/{encodedFilename}
  const prefix = COLLECTION_PREFIX[collectionSlug] || collectionSlug
  const encodedFilename = encodeURIComponent(decodeURIComponent(filename))
  return NextResponse.redirect(`${blobBaseUrl}/${prefix}/${encodedFilename}`, { status: 302 })
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // Redirect media files to Vercel Blob CDN (skip serverless proxy)
  const mediaRedirect = handleMediaRedirect(request)
  if (mediaRedirect) return mediaRedirect

  // Exclude paths from locale handling (double safety, even though matcher already excludes many)
  const shouldExclude =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')

  if (shouldExclude) {
    return NextResponse.next()
  }

  let locale: Locale = defaultLocale
  let shouldSetCookie = false

  // Subdomain-based locale forcing
  const subdomainLocale = getLocaleFromSubdomain(host)
  if (subdomainLocale) {
    locale = subdomainLocale
    shouldSetCookie = true
  } else {
    // On primary domain, check cookie first
    const cookieLocale = request.cookies.get(cookieName)?.value as Locale | undefined

    if (cookieLocale && locales.includes(cookieLocale)) {
      locale = cookieLocale
    } else {
      // Fallback to Accept-Language header
      const acceptLanguage = request.headers.get('accept-language')
      if (acceptLanguage) {
        const preferredLocale = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase() as
          | Locale
          | undefined

        if (preferredLocale && locales.includes(preferredLocale)) {
          locale = preferredLocale
          shouldSetCookie = true
        }
      }
    }
  }

  const response = NextResponse.next()

  if (shouldSetCookie) {
    const cookieDomain = resolveCookieDomain(host)
    const isHttps = request.nextUrl.protocol === 'https:'
    const isProd = process.env.NODE_ENV === 'production'

    response.cookies.set(cookieName, locale, {
      maxAge: 31536000,
      path: '/',
      sameSite: 'lax',
      secure: isHttps || isProd,
      // Only set domain when it's safe/valid (custom domain).
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    })
  }

  // Set locale header for next-intl (or your own resolver)
  response.headers.set('x-locale', locale)

  return response
}

export const config = {
  matcher: [
    // Media files — redirect to Blob CDN (must run before the general exclude)
    '/api/media/file/:path*',
    '/api/exercise-assets/file/:path*',
    // Locale handling — exclude admin, other api routes, static assets
    '/((?!api|admin|_next|_static|.*\\..*).*)',
  ],
}
