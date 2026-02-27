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

  // Map to safe response (no systemPrompt/template)
  const teacherProfile = userSettings.teacherProfile
    ? {
        slug: (userSettings.teacherProfile as { slug?: string }).slug,
        label: (userSettings.teacherProfile as { label?: string }).label,
        description: (userSettings.teacherProfile as { description?: string }).description,
      }
    : null

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

  // Verify profile exists and is enabled
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
