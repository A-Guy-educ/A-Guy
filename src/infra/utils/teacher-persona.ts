/**
 * Teacher Persona Resolution
 *
 * Resolves the active teacher persona based on:
 * 1. Logged-in user's UserPreferences.teacherPersona
 * 2. Anonymous cookie value
 * 3. Fallback to persona_focused
 *
 * @fileType utility
 * @domain chat
 * @ai-summary Resolves active teacher persona from user prefs or cookie
 */

import type { Payload, User } from 'payload'

import type { Prompt } from '@/payload-types'
import { logger } from '@/infra/utils/logger'
import {
  getPersonaCookie,
  getDefaultPersonaSlug,
  isValidPersonaSlug,
  type ValidPersonaSlug,
} from '@/infra/utils/persona-cookie'

interface PersonaResolutionResult {
  persona: Prompt | null
  personaSlug: ValidPersonaSlug
  resolvedFrom: 'user-preferences' | 'cookie' | 'fallback'
}

/**
 * Resolve the active teacher persona for a request
 *
 * Resolution order:
 * 1. UserPreferences.teacherPersona (if logged in)
 * 2. Cookie value (if valid)
 * 3. Fallback: persona_focused
 *
 * @param payload - Payload instance
 * @param user - Optional authenticated user
 * @returns The resolved persona and source
 */
export async function resolveTeacherPersona(
  payload: Payload,
  user?: User | null,
): Promise<PersonaResolutionResult> {
  // 1. Try to get from user preferences (if logged in)
  if (user?.id) {
    try {
      const userPrefs = await payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: 'user-preferences' as any,
        where: {
          user: { equals: user.id },
        },
        limit: 1,
        depth: 1, // Populate the teacherPersona relationship
        overrideAccess: false, // Enforce access control
      })

      if (userPrefs.docs.length > 0) {
        const prefs = userPrefs.docs[0] as unknown as {
          teacherPersona?: { slug?: string; template?: string } | null
        }

        if (prefs.teacherPersona?.slug) {
          const personaSlug = prefs.teacherPersona.slug
          if (isValidPersonaSlug(personaSlug)) {
            logger.debug({ personaSlug, userId: user.id }, 'Resolved persona from user preferences')
            return {
              persona: prefs.teacherPersona as Prompt,
              personaSlug,
              resolvedFrom: 'user-preferences',
            }
          }
        }
      }
    } catch (error) {
      logger.warn({ err: error, userId: user.id }, 'Failed to fetch user preferences')
    }
  }

  // 2. Try to get from cookie (anonymous users)
  try {
    const cookieSlug = await getPersonaCookie()
    if (cookieSlug && isValidPersonaSlug(cookieSlug)) {
      logger.debug({ cookieSlug }, 'Resolved persona from cookie')

      // Fetch the full prompt for the cookie slug
      const prompt = await fetchPersonaBySlug(payload, cookieSlug)
      if (prompt) {
        return {
          persona: prompt,
          personaSlug: cookieSlug,
          resolvedFrom: 'cookie',
        }
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to read persona cookie')
  }

  // 3. Fallback to default
  const defaultSlug = getDefaultPersonaSlug()
  logger.debug({ defaultSlug }, 'Using default persona')

  // Fetch the default prompt
  const defaultPrompt = await fetchPersonaBySlug(payload, defaultSlug)

  return {
    persona: defaultPrompt,
    personaSlug: defaultSlug,
    resolvedFrom: 'fallback',
  }
}

/**
 * Fetch a persona prompt by slug
 */
async function fetchPersonaBySlug(payload: Payload, slug: string): Promise<Prompt | null> {
  try {
    const result = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'prompts' as any,
      where: {
        and: [
          { slug: { equals: slug } },
          { type: { equals: 'persona' } },
          { status: { equals: 'published' } },
        ],
      },
      limit: 1,
      overrideAccess: true, // Admin-only collection, need override
    })

    return result.docs[0] as Prompt | null
  } catch (error) {
    logger.error({ err: error, slug }, 'Failed to fetch persona by slug')
    return null
  }
}

/**
 * Get the teacher persona XML block for prompt injection
 *
 * @param persona - The resolved persona prompt
 * @returns XML block for system prompt injection
 */
export function getPersonaXmlBlock(persona: Prompt | null): string {
  if (!persona?.template) {
    return ''
  }

  return `<teacher_persona>
${persona.template}
</teacher_persona>`
}
