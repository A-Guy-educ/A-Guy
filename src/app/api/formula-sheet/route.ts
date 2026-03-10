/**
 * Formula Sheet API Endpoint
 *
 * GET /api/formula-sheet?lessonId=xxx
 * Returns the formula sheet for a given lesson (if any)
 */

import { NextRequest, NextResponse } from 'next/server'

import { getSystemLocale } from '@/i18n/server-locale'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { queryFormulaSheetForLesson } from '@/server/repos/queries/formula-sheets'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const lessonId = searchParams.get('lessonId')
    const localeParam = searchParams.get('locale')

    // Return 400 if lessonId is missing
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId query parameter is required' }, { status: 400 })
    }

    // Resolve locale: use query param if provided, otherwise use system locale
    let locale: ContentLocale = 'he'
    if (localeParam && (localeParam === 'he' || localeParam === 'en')) {
      locale = localeParam
    } else {
      try {
        const systemLocale = await getSystemLocale()
        if (systemLocale === 'en' || systemLocale === 'he') {
          locale = systemLocale
        }
      } catch {
        // Use default 'he' if system locale fails
      }
    }

    // Query the formula sheet
    const formulaSheet = await queryFormulaSheetForLesson({ lessonId, locale })

    // Return the result (can be null if no sheet exists)
    return NextResponse.json({ formulaSheet })
  } catch (error) {
    console.error('[FormulaSheet API] Error:', error)

    // Don't expose internal errors
    return NextResponse.json({ error: 'Failed to fetch formula sheet' }, { status: 500 })
  }
}
