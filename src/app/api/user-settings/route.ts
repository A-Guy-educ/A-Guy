/**
 * User Settings API
 *
 * GET /api/user-settings
 * Returns the current user's settings including teacher profile selection
 *
 * PATCH /api/user-settings
 * Updates the current user's teacher profile selection
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'
import { cookieName, defaultLocale, type Locale, locales } from '@/i18n/config'

function getLocaleFromRequest(req: Request): Locale {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`))
  const value = match?.[1] as Locale | undefined
  return value && locales.includes(value) ? value : defaultLocale
}

const patchSchema = z.object({
  teacherProfileSlug: z.string(),
})

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id
  const locale = getLocaleFromRequest(req)

  // Fetch user settings with populated teacher profile
  const settings = await payload.find({
    collection: 'user_settings',
    where: {
      user: { equals: userId },
    },
    depth: 1, // Populate teacherProfile
    limit: 1,
    overrideAccess: true, // Collection uses authenticatedOrOwner, but we verified user
  })

  if (settings.docs.length === 0) {
    // No settings yet - return null for teacher profile
    return Response.json({
      settings: {
        id: null,
        teacherProfile: null,
      },
    })
  }

  const userSettings = settings.docs[0]

  // The stored teacherProfile may be in any locale.
  // Look up the locale-matching version by slug.
  type PopulatedProfile = { slug?: string }
  const storedProfile = userSettings.teacherProfile as PopulatedProfile | string | null

  let teacherProfile = null

  if (storedProfile && typeof storedProfile === 'object' && storedProfile.slug) {
    const localeProfile = await payload.find({
      collection: 'teacher_profiles',
      where: {
        and: [{ slug: { equals: storedProfile.slug } }, { locale: { equals: locale } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    const profile = localeProfile.docs[0]
    if (profile) {
      teacherProfile = {
        slug: profile.slug,
        label: profile.label,
        description: profile.description ?? '',
      }
    }
  }

  return Response.json({
    settings: {
      id: userSettings.id,
      teacherProfile,
    },
  })
}

export async function PATCH(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = patchSchema.safeParse(body)

  if (!validation.success) {
    return Response.json(
      { error: 'Invalid request', details: validation.error.flatten() },
      { status: 400 },
    )
  }

  const { teacherProfileSlug } = validation.data

  // Verify profile exists and is enabled (any locale doc suffices for validation)
  const profileResult = await payload.find({
    collection: 'teacher_profiles',
    where: {
      slug: { equals: teacherProfileSlug },
      isEnabled: { equals: true },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (profileResult.docs.length === 0) {
    return Response.json({ error: 'Teacher profile not found or disabled' }, { status: 404 })
  }

  const profileId = profileResult.docs[0].id

  // Find or create user settings (lazy creation)
  const existingSettings = await payload.find({
    collection: 'user_settings',
    where: {
      user: { equals: userId },
    },
    limit: 1,
    overrideAccess: true,
  })

  let settingsId: string

  if (existingSettings.docs.length > 0) {
    // Update existing
    const updated = await payload.update({
      collection: 'user_settings',
      id: existingSettings.docs[0].id,
      data: {
        teacherProfile: profileId,
      },
      overrideAccess: true,
    })
    settingsId = updated.id as string
  } else {
    // Create new
    const created = await payload.create({
      collection: 'user_settings',
      data: {
        user: userId,
        teacherProfile: profileId,
      },
      overrideAccess: true,
    })
    settingsId = created.id as string
  }

  return Response.json({
    success: true,
    settings: {
      id: settingsId,
      teacherProfileSlug,
    },
  })
}
