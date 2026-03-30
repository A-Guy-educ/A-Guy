/**
 * Teacher Profiles API
 *
 * GET /api/teacher-profiles
 * Returns list of active teacher profiles for profile selection UI
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { cookieName, defaultLocale, type Locale, locales } from '@/i18n/config'
import { localeWhereClause } from '@/server/payload/fields/contentLocale'

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

  const locale = getLocaleFromRequest(req)

  // Fetch active teacher profiles for the user's locale
  const profiles = await payload.find({
    collection: 'teacher_profiles',
    where: {
      and: [{ isEnabled: { equals: true } }, localeWhereClause(locale)],
    },
    sort: 'label',
    overrideAccess: true, // Collection is adminOnly, but we're authenticated
  })

  // Map to safe response (no systemPrompt/template)
  const responseProfiles = profiles.docs.map((profile) => ({
    slug: profile.slug,
    label: profile.label,
    description: profile.description ?? '',
    isEnabled: profile.isEnabled,
  }))

  return Response.json({
    profiles: responseProfiles,
  })
}
