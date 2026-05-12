/**
 * Teacher Profiles API
 *
 * GET /api/teacher-profiles
 * Returns list of active teacher profiles for profile selection UI
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { cookieName, defaultLocale, type Locale, locales } from '@/i18n/config'
import { isValidContentLocale, localeWhereClause } from '@/server/payload/fields/contentLocale'

function getLocaleFromRequest(req: Request): Locale {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`))
  const value = match?.[1] as Locale | undefined
  return value && locales.includes(value) ? value : defaultLocale
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawLocale = getLocaleFromRequest(req)
  const locale = isValidContentLocale(rawLocale) ? rawLocale : undefined

  // Fetch active teacher profiles for the user's locale (with backwards-compat fallback)
  const profiles = await payload.find({
    collection: 'teacher_profiles',
    where: {
      and: [{ isEnabled: { equals: true } }, ...(locale ? [localeWhereClause(locale)] : [])],
    },
    sort: 'label',
    overrideAccess: true, // Collection is adminOnly, but we're authenticated
  })

  // Map to safe response (no systemPrompt/template), deduplicate by slug
  const seen = new Set<string>()
  const responseProfiles = profiles.docs
    .filter((profile) => {
      if (seen.has(profile.slug)) return false
      seen.add(profile.slug)
      return true
    })
    .map((profile) => ({
      slug: profile.slug,
      label: profile.label,
      description: profile.description ?? '',
      isEnabled: profile.isEnabled,
    }))

  return Response.json({
    profiles: responseProfiles,
  })
}
