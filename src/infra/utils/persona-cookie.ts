/**
 * Persona Cookie Utilities
 *
 * Manages the teacher persona cookie for anonymous users.
 * Uses short-lived cookies to store persona preference until registration.
 *
 * @fileType utility
 * @domain chat
 * @ai-summary Cookie utilities for anonymous persona tracking
 */

import { cookies } from 'next/headers'

// Cookie name for storing anonymous persona preference
export const PERSONA_COOKIE_NAME = 'teacher_persona'

// Cookie expiry in seconds (7 days)
const PERSONA_COOKIE_EXPIRY_SECONDS = 7 * 24 * 60 * 60

// Default persona when no selection is made
export const DEFAULT_PERSONA_SLUG = 'persona_focused'

/**
 * Valid persona slugs (for validation)
 */
export const VALID_PERSONA_SLUGS = [
  'persona_strict',
  'persona_thorough',
  'persona_patient',
  'persona_focused',
  'persona_challenging',
] as const

export type ValidPersonaSlug = (typeof VALID_PERSONA_SLUGS)[number]

/**
 * Set the persona cookie for anonymous users (server-side)
 *
 * @param personaSlug - The persona slug to store
 */
export async function setPersonaCookie(personaSlug: string): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(PERSONA_COOKIE_NAME, personaSlug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PERSONA_COOKIE_EXPIRY_SECONDS,
    path: '/',
  })
}

/**
 * Get the persona cookie value (server-side)
 *
 * @returns The persona slug or null if not set
 */
export async function getPersonaCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(PERSONA_COOKIE_NAME)

  return cookie?.value ?? null
}

/**
 * Clear the persona cookie (e.g., after registration)
 */
export async function clearPersonaCookie(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.delete(PERSONA_COOKIE_NAME)
}

/**
 * Validate if a persona slug is valid
 *
 * @param slug - The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidPersonaSlug(slug: string): slug is ValidPersonaSlug {
  return VALID_PERSONA_SLUGS.includes(slug as ValidPersonaSlug)
}

/**
 * Get the default persona slug
 *
 * @returns The default persona slug
 */
export function getDefaultPersonaSlug(): ValidPersonaSlug {
  return DEFAULT_PERSONA_SLUG
}
