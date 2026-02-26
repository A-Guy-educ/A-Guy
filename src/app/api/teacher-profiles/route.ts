/**
 * Teacher Profiles API
 *
 * GET /api/teacher-profiles
 * Returns list of active teacher profiles for profile selection UI
 */

import { getPayload } from 'payload'

import config from '@payload-config'

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check - return 401 if not authenticated
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch active teacher profiles
  const profiles = await payload.find({
    collection: 'teacher_profiles',
    where: {
      isEnabled: { equals: true },
    },
    sort: 'label',
    overrideAccess: true, // Collection is adminOnly, but we're authenticated
  })

  // Map to safe response (no systemPrompt/template)
  const responseProfiles = profiles.docs.map((profile) => ({
    slug: profile.slug,
    label: profile.label,
    description: profile.description,
    isEnabled: profile.isEnabled,
  }))

  return Response.json({
    profiles: responseProfiles,
  })
}
