import { NextRequest, NextResponse } from 'next/server'
import {
  cookieName,
  defaultLocale,
  type Locale,
  locales,
  getLocaleFromSubdomain,
} from './src/i18n/config'

/** File extensions that should be redirected to Vercel Blob CDN instead of proxied */
const STREAMABLE_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
])

/**
 * Extract the Vercel Blob base URL from the storage token.
 * Token format: vercel_blob_rw_<storeId>_<random>
 */
function getBlobBaseUrl(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return null
  const match = token.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)
  if (!match) return null
  return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`
}

/**
 * Redirect large streamable media files (video/audio) directly to Vercel Blob CDN.
 * This avoids proxying through the serverless function which causes timeouts for large files.
 */
function handleMediaRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/media/file/')) return null

  const filename = pathname.slice('/api/media/file/'.length)
  if (!filename) return null

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!STREAMABLE_EXTENSIONS.has(ext)) return null

  const blobBaseUrl = getBlobBaseUrl()
  if (!blobBaseUrl) return null

  return NextResponse.redirect(`${blobBaseUrl}/${filename}`, { status: 302 })
}

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // Redirect streamable media (video/audio) to Vercel Blob CDN to avoid proxy timeouts
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
    // Locale handling (excludes api, admin, static assets)
    '/((?!api|admin|_next|_static|.*\\..*).*)',
    // Media proxy redirect (video/audio → Blob CDN to avoid serverless timeouts)
    '/api/media/file/:path*',
  ],
}
