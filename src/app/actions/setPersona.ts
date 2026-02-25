'use server'

/**
 * Set Persona Server Action
 *
 * Sets the teacher persona for a user.
 * - For logged-in users: saves to UserPreferences collection
 * - For anonymous users: sets a cookie
 *
 * @fileType server-action
 * @domain chat
 * @ai-summary Server action to set teacher persona preference
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import {
  clearPersonaCookie,
  getPersonaCookie,
  isValidPersonaSlug,
  DEFAULT_PERSONA_SLUG,
} from '@/infra/utils/persona-cookie'

interface SetPersonaResult {
  success: boolean
  error?: string
  message?: string
}

/**
 * Set the teacher persona for the current user
 *
 * @returns Result of the operation
 */
export async function setPersonaAction(): Promise<SetPersonaResult> {
  try {
    // Get the persona from cookie
    const cookieSlug = await getPersonaCookie()

    // Validate the persona slug
    if (!cookieSlug || !isValidPersonaSlug(cookieSlug)) {
      return {
        success: false,
        error: 'Invalid persona selection',
      }
    }

    // Get payload instance
    const payload = await getPayload({ config })

    // Try to get the authenticated user
    const { user } = await payload.auth({
      headers: new Headers(),
    })

    if (user?.id) {
      // User is logged in - save to UserPreferences
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingPrefs = await payload.find({
        collection: 'user-preferences' as any,
        where: {
          user: { equals: user.id },
        },
        limit: 1,
        overrideAccess: true, // Admin-only collection
      })

      if (existingPrefs.docs.length > 0) {
        // Update existing preferences
        await payload.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: 'user-preferences' as any,
          id: existingPrefs.docs[0].id,
          data: {
            teacherPersona: cookieSlug,
          },
          overrideAccess: true,
        })
      } else {
        // Create new preferences
        await payload.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: 'user-preferences' as any,
          data: {
            user: user.id,
            teacherPersona: cookieSlug,
          },
          overrideAccess: true,
        })
      }
    }

    return {
      success: true,
      message: 'Persona saved successfully',
    }
  } catch (error) {
    console.error('Error setting persona:', error)
    return {
      success: false,
      error: 'Failed to save persona preference',
    }
  }
}

/**
 * Set persona from registration - migrates cookie to UserPreferences
 *
 * @param userId - The newly created user ID
 * @returns Result of the operation
 */
export async function migratePersonaOnRegistration(userId: string): Promise<SetPersonaResult> {
  try {
    // Get the persona from cookie
    const cookieSlug = await getPersonaCookie()

    // Use cookie value or default
    const personaSlug =
      cookieSlug && isValidPersonaSlug(cookieSlug) ? cookieSlug : DEFAULT_PERSONA_SLUG

    // Get payload instance
    const payload = await getPayload({ config })

    // Create UserPreferences with the persona
    await payload.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'user-preferences' as any,
      data: {
        user: userId,
        teacherPersona: personaSlug,
      },
      overrideAccess: true,
    })

    // Clear the anonymous cookie after migration
    await clearPersonaCookie()

    return {
      success: true,
      message: 'Persona migrated successfully',
    }
  } catch (error) {
    console.error('Error migrating persona:', error)
    // Don't fail registration if persona migration fails
    return {
      success: true,
      message: 'Registration successful (persona migration failed)',
    }
  }
}
