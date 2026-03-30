/**
 * Teacher Profile Resolver Service
 *
 * Resolves the appropriate teacher profile for a given user or guest.
 * Implements a tiered resolution strategy:
 * - Authenticated users: Tier 1 (user settings) → Tier 2 (default) → Tier 3 (first active) → Tier 4 (failsafe)
 * - Guests: Tier 2 (default) → Tier 4 (failsafe)
 */

import type { Payload } from 'payload'

import { logger as rootLogger } from '@/infra/utils/logger'
import type { UserSetting } from '@/payload-types'

/**
 * Default teacher profile slug - hardcoded for v1.1
 * Changing this requires a code change + PR
 */
export const DEFAULT_TEACHER_PROFILE_SLUG = 'teacher_focused'

/**
 * Failsafe prompt template - used when no other profile is available
 * This should never be reached in normal operation
 */
const FAILSAFE_TEACHER_PROMPT = `You are a helpful and knowledgeable AI teacher.
Provide clear, accurate explanations tailored to the student's level of understanding.
Always encourage critical thinking and questions.
Be patient, supportive, and maintain a positive learning environment.`

const log = rootLogger.child({ module: 'TeacherProfileResolver' })

/**
 * Resolution source tracking for logging
 */
export type ResolvedFrom = 'user-settings' | 'default-config' | 'first-active' | 'failsafe'

/**
 * Resolved teacher profile result
 */
export interface ResolvedTeacherProfile {
  profileSlug: string
  profileLabel: string
  profileDescription: string
  promptTemplate: string
  resolvedFrom: ResolvedFrom
}

/**
 * Payload types for the populated profile
 */
interface PopulatedTeacherProfile {
  slug: string
  label: string
  description: string | null
  isEnabled: boolean
  systemPrompt: {
    template: string
    status: string
  }
}

/**
 * Validates that a profile's prompt is usable
 */
function isPromptValid(
  prompt: PopulatedTeacherProfile['systemPrompt'] | null | undefined,
): boolean {
  if (!prompt) return false
  if (prompt.status !== 'published') return false
  if (!prompt.template || prompt.template.trim() === '') return false
  return true
}

/**
 * Resolves the teacher profile for a given user ID or guest
 *
 * @param payload - Payload instance
 * @param userId - Optional user ID (omit for guest)
 * @returns Resolved teacher profile with all necessary details
 */
export async function resolveTeacherProfile(
  payload: Payload,
  userId?: string,
): Promise<ResolvedTeacherProfile> {
  // Authenticated user resolution path
  if (userId) {
    // Tier 1: Load from user settings
    const tier1Result = await resolveTier1UserSettings(payload, userId)
    if (tier1Result) return tier1Result
  }

  // Tier 2: Default profile by slug
  const tier2Result = await resolveTier2DefaultProfile(payload)
  if (tier2Result) return tier2Result

  // Tier 3: First active profile (authenticated users only)
  if (userId) {
    const tier3Result = await resolveTier3FirstActive(payload)
    if (tier3Result) return tier3Result
  }

  // Tier 4: Failsafe
  return resolveTier4Failsafe()
}

/**
 * Tier 1: Load user settings and check selected profile
 */
async function resolveTier1UserSettings(
  payload: Payload,
  userId: string,
): Promise<ResolvedTeacherProfile | null> {
  try {
    const userSettings = await payload.find({
      collection: 'user_settings',
      where: {
        user: { equals: userId },
      },
      depth: 2, // Populate teacherProfile → systemPrompt
      limit: 1,
      overrideAccess: true, // Server-side read, auth verified by caller
    })

    if (userSettings.docs.length === 0) {
      return null
    }

    const settings = userSettings.docs[0] as unknown as UserSetting & {
      teacherProfile: PopulatedTeacherProfile | null
    }

    const profile = settings.teacherProfile

    if (!profile) {
      return null
    }

    // Check if profile is enabled and prompt is valid
    if (profile.isEnabled === true && isPromptValid(profile.systemPrompt)) {
      log.debug({ profileSlug: profile.slug, userId }, 'Resolved from user-settings')

      return {
        profileSlug: profile.slug,
        profileLabel: profile.label,
        profileDescription: profile.description || '',
        promptTemplate: profile.systemPrompt.template,
        resolvedFrom: 'user-settings',
      }
    }

    // Profile disabled or prompt invalid - fall through to next tier
    return null
  } catch (error) {
    log.error({ err: error, userId }, 'Error resolving user settings')
    return null
  }
}

/**
 * Tier 2: Default profile by slug
 */
async function resolveTier2DefaultProfile(
  payload: Payload,
): Promise<ResolvedTeacherProfile | null> {
  try {
    const result = await payload.find({
      collection: 'teacher_profiles',
      where: {
        slug: { equals: DEFAULT_TEACHER_PROFILE_SLUG },
        isEnabled: { equals: true },
      },
      depth: 1, // Populate systemPrompt one level
      limit: 1,
      overrideAccess: true, // Server-side read, collection is adminOnly
    })

    if (result.docs.length === 0) {
      return null
    }

    const profile = result.docs[0] as unknown as PopulatedTeacherProfile

    if (isPromptValid(profile.systemPrompt)) {
      log.debug({ profileSlug: profile.slug }, 'Resolved from default-config')

      return {
        profileSlug: profile.slug,
        profileLabel: profile.label,
        profileDescription: profile.description || '',
        promptTemplate: profile.systemPrompt.template,
        resolvedFrom: 'default-config',
      }
    }

    return null
  } catch (error) {
    log.error({ err: error }, 'Error resolving default profile')
    return null
  }
}

/**
 * Tier 3: First active profile (authenticated users only)
 */
async function resolveTier3FirstActive(payload: Payload): Promise<ResolvedTeacherProfile | null> {
  try {
    const result = await payload.find({
      collection: 'teacher_profiles',
      where: {
        isEnabled: { equals: true },
      },
      depth: 1,
      limit: 1,
      sort: 'createdAt',
      overrideAccess: true, // Server-side read, collection is adminOnly
    })

    if (result.docs.length === 0) {
      return null
    }

    const profile = result.docs[0] as unknown as PopulatedTeacherProfile

    if (isPromptValid(profile.systemPrompt)) {
      log.debug({ profileSlug: profile.slug }, 'Resolved from first-active')

      return {
        profileSlug: profile.slug,
        profileLabel: profile.label,
        profileDescription: profile.description || '',
        promptTemplate: profile.systemPrompt.template,
        resolvedFrom: 'first-active',
      }
    }

    return null
  } catch (error) {
    log.error({ err: error }, 'Error resolving first active profile')
    return null
  }
}

/**
 * Tier 4: Failsafe - hardcoded prompt
 */
function resolveTier4Failsafe(): ResolvedTeacherProfile {
  log.warn('Using failsafe prompt - no valid profiles found')

  return {
    profileSlug: 'failsafe',
    profileLabel: 'Default Teacher',
    profileDescription: 'Fallback teacher profile',
    promptTemplate: FAILSAFE_TEACHER_PROMPT,
    resolvedFrom: 'failsafe',
  }
}
