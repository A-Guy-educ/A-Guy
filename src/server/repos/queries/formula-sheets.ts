/**
 * Formula Sheets Query Module
 *
 * @fileType query-module
 * @domain formula-sheets
 * @pattern data-fetching, caching
 * @ai-summary Server-side queries for formula sheet resolution with locale fallback
 */

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { ContentLocale } from '@/server/payload/fields/contentLocale'

import type { FormulaSheet } from '@/payload-types'

/**
 * Result type for resolved formula sheet
 */
export interface ResolvedFormulaSheet {
  sheet: FormulaSheet
  source: 'lesson' | 'course'
}

/**
 * Get the opposite locale for fallback
 */
function getOppositeLocale(locale: ContentLocale): ContentLocale {
  return locale === 'en' ? 'he' : 'en'
}

/**
 * Fetch a formula sheet by ID with locale-aware fallback.
 *
 * Returns the sheet if it is published and matches either the requested
 * locale or the opposite locale (with preference for the requested one).
 */
async function fetchFormulaSheet({
  id,
  locale,
}: {
  id: string
  locale: ContentLocale
}): Promise<FormulaSheet | null> {
  try {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.findByID({
      collection: 'formula-sheets',
      id,
      depth: 1,
      overrideAccess: true,
      disableErrors: true,
    })

    if (!result || result.status !== 'published') {
      return null
    }

    // Accept if locale matches the requested one or the fallback
    if (result.locale === locale || result.locale === getOppositeLocale(locale)) {
      return result
    }

    return null
  } catch {
    return null
  }
}

/**
 * Resolve formula sheet with fallback hierarchy:
 * 1. Lesson-specific formula sheet (if set and published)
 * 2. Course default formula sheet (if set and published)
 * 3. null (no formula sheet available)
 *
 * Locale fallback is applied at each step: requested locale → opposite locale
 *
 * @param lessonId - The lesson ID to resolve formula sheet for
 * @param courseId - The course ID (used if lesson has no formula sheet)
 * @param locale - The content locale (en/he)
 * @returns Resolved formula sheet with source info, or null
 */
export const resolveFormulaSheet = cache(
  async ({
    lessonId,
    courseId,
    locale,
  }: {
    lessonId: string
    courseId: string
    locale: ContentLocale
  }): Promise<ResolvedFormulaSheet | null> => {
    const payload = await getPayload({ config: configPromise })

    // Step 1: Try to fetch the lesson's formula sheet
    const lessonResult = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })

    if (!lessonResult) {
      return null
    }

    // Get lesson's formula sheet ID (could be ID or object with id)
    const lessonFormulaSheetId =
      typeof lessonResult.formulaSheet === 'string'
        ? lessonResult.formulaSheet
        : lessonResult.formulaSheet?.id

    if (lessonFormulaSheetId) {
      const lessonSheet = await fetchFormulaSheet({
        id: lessonFormulaSheetId,
        locale,
      })

      if (lessonSheet) {
        return { sheet: lessonSheet, source: 'lesson' }
      }
    }

    // Step 2: Try course's formula sheet
    const courseResult = await payload.findByID({
      collection: 'courses',
      id: courseId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })

    if (!courseResult) {
      return null
    }

    // Get course's formula sheet ID
    const courseFormulaSheetId =
      typeof courseResult.formulaSheet === 'string'
        ? courseResult.formulaSheet
        : courseResult.formulaSheet?.id

    if (courseFormulaSheetId) {
      const courseSheet = await fetchFormulaSheet({
        id: courseFormulaSheetId,
        locale,
      })

      if (courseSheet) {
        return { sheet: courseSheet, source: 'course' }
      }
    }

    // No formula sheet found
    return null
  },
)
