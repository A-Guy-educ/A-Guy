/**
 * Agent Behavior Prompt Resolver Service
 *
 * Resolves the appropriate agent behavior prompt for a given user or guest.
 * Implements a tiered resolution strategy:
 * - Tier 1 (Authenticated users): User settings → Tier 2 → Tier 3 → Tier 4 (failsafe)
 * - Tier 2: Default by isDefault flag → Tier 3 → Tier 4 (failsafe)
 * - Tier 3: Highest priority published → Tier 4 (failsafe)
 */

import type { Payload } from 'payload'

import { logger as rootLogger } from '@/infra/utils/logger'

/**
 * Default agent behavior prompt slug - hardcoded for v1
 */
export const DEFAULT_AGENT_BEHAVIOR_PROFILE_SLUG = 'supportive-guide'

/**
 * Failsafe prompt template - used when no other profile is available
 */
const FAILSAFE_AGENT_BEHAVIOR_PROMPT = `You are a supportive and encouraging personal learning assistant.
You provide personalized guidance, motivation, and recommendations to help students learn effectively.
Be patient, supportive, and maintain a positive learning environment.
Always encourage questions and celebrate progress.
Provide clear, actionable recommendations for what to learn next.`

const log = rootLogger.child({ module: 'AgentBehaviorPromptResolver' })

/**
 * Resolution source tracking for logging
 */
export type ResolvedAgentBehaviorFrom =
  | 'user-settings'
  | 'default-config'
  | 'highest-priority'
  | 'failsafe'

/**
 * Resolved agent behavior prompt result
 */
export interface ResolvedAgentBehavior {
  profileSlug: string
  profileLabel: string
  profileDescription: string
  template: string
  resolvedFrom: ResolvedAgentBehaviorFrom
}

/**
 * Payload types for the populated agent behavior prompt
 */
interface AgentBehaviorPromptDoc {
  slug: string
  title: string
  description: string | null
  isEnabled: boolean
  isDefault: boolean
  template: string
  status: string
  priority: number
}

/**
 * Validates that a prompt is usable
 */
function isPromptValid(prompt: AgentBehaviorPromptDoc | null | undefined): boolean {
  if (!prompt) return false
  if (prompt.status !== 'published') return false
  if (!prompt.isEnabled) return false
  if (!prompt.template || prompt.template.trim() === '') return false
  return true
}

/**
 * Resolves the agent behavior prompt for a given user ID or guest
 */
export async function resolveAgentBehaviorPrompt(
  payload: Payload,
  userId?: string,
  locale?: string,
): Promise<ResolvedAgentBehavior> {
  // Tier 1: Default by isDefault flag (for now, user settings not implemented)
  const tier1Result = await resolveTier1DefaultProfile(payload, locale)
  if (tier1Result) return tier1Result

  // Tier 2: Highest priority published profile
  const tier2Result = await resolveTier2HighestPriority(payload, locale)
  if (tier2Result) return tier2Result

  // Tier 3: Failsafe
  return resolveTier3Failsafe()
}

/**
 * Tier 1: Default profile by isDefault flag
 */
async function resolveTier1DefaultProfile(
  payload: Payload,
  locale?: string,
): Promise<ResolvedAgentBehavior | null> {
  try {
    const baseWhere = {
      isDefault: { equals: true },
      isEnabled: { equals: true },
      status: { equals: 'published' },
    }

    const result = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- collection slug not yet in generated payload-types
      collection: 'agent-behavior-prompts' as any,
      where: locale ? { and: [baseWhere, { locale: { equals: locale } }] } : baseWhere,
      limit: 1,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return null
    }

    const profile = result.docs[0] as unknown as AgentBehaviorPromptDoc

    if (isPromptValid(profile)) {
      log.debug({ profileSlug: profile.slug }, 'Resolved from default-config')

      return {
        profileSlug: profile.slug,
        profileLabel: profile.title,
        profileDescription: profile.description || '',
        template: profile.template,
        resolvedFrom: 'default-config',
      }
    }

    return null
  } catch (error) {
    log.error({ err: error }, 'Error resolving default agent behavior profile')
    return null
  }
}

/**
 * Tier 2: Highest priority published profile
 */
async function resolveTier2HighestPriority(
  payload: Payload,
  locale?: string,
): Promise<ResolvedAgentBehavior | null> {
  try {
    const baseWhere = {
      isEnabled: { equals: true },
      status: { equals: 'published' },
    }

    const result = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- collection slug not yet in generated payload-types
      collection: 'agent-behavior-prompts' as any,
      where: locale ? { and: [baseWhere, { locale: { equals: locale } }] } : baseWhere,
      limit: 1,
      sort: '-priority',
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return null
    }

    const profile = result.docs[0] as unknown as AgentBehaviorPromptDoc

    if (isPromptValid(profile)) {
      log.debug(
        { profileSlug: profile.slug, priority: profile.priority },
        'Resolved from highest-priority',
      )

      return {
        profileSlug: profile.slug,
        profileLabel: profile.title,
        profileDescription: profile.description || '',
        template: profile.template,
        resolvedFrom: 'highest-priority',
      }
    }

    return null
  } catch (error) {
    log.error({ err: error }, 'Error resolving highest priority agent behavior profile')
    return null
  }
}

/**
 * Tier 3: Failsafe - hardcoded prompt
 */
function resolveTier3Failsafe(): ResolvedAgentBehavior {
  log.warn('Using failsafe agent behavior prompt - no valid profiles found')

  return {
    profileSlug: 'failsafe',
    profileLabel: 'Learning Guide',
    profileDescription: 'Fallback agent behavior profile',
    template: FAILSAFE_AGENT_BEHAVIOR_PROMPT,
    resolvedFrom: 'failsafe',
  }
}

/**
 * Builds the agent behavior block for system prompt injection
 */
export function buildAgentBehaviorBlock(profile: ResolvedAgentBehavior): string {
  const block = `<agent_behavior>
Name: ${profile.profileLabel}
Description: ${profile.profileDescription}

Behavior:
${profile.template}
</agent_behavior>`

  return block
}
