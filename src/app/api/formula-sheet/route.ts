/**
 * Formula Sheet API Endpoint
 *
 * GET /api/formula-sheet?lessonId=xxx
 * Returns the formula sheet for a given lesson (if any)
 */

import { NextRequest, NextResponse } from 'next/server'

import { getSystemLocale } from '@/i18n/server-locale'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

type FormulaSheetDTO = {
  id: string
  name: string
  locale: ContentLocale
  kind: 'richtext' | 'pdf'
  content?: unknown
  pdfFile?: {
    id: string
    url?: string | null
    filename?: string | null
  } | null
  pdfStatus?: 'ok' | 'missing'
  isEmpty?: boolean
}

function isRichTextEmpty(content: unknown): boolean {
  if (!content || typeof content !== 'object') return true
  const contentObj = content as Record<string, unknown>
  if (contentObj.root && typeof contentObj.root === 'object') {
    const root = contentObj.root as Record<string, unknown>
    const children = root.children as Array<unknown> | undefined
    return !children || children.length === 0
  }
  return Object.keys(contentObj).length === 0
}

// Cached function to query formula sheet for a lesson
const queryFormulaSheetForLesson = cache(
  async ({
    lessonId,
    locale = 'he',
  }: {
    lessonId: string
    locale?: ContentLocale
  }): Promise<FormulaSheetDTO | null> => {
    const payload = await getPayload({ config: configPromise })

    // Step 1: Fetch the lesson to get formulaSheet reference
    const lesson = (await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: false,
      disableErrors: true,
    })) as {
      formulaSheet?: string | { id: string } | null
      chapter: string | { id: string }
      status?: string
      isActive?: boolean
    } | null

    // If lesson doesn't exist or not published/active, return null
    if (!lesson || lesson.status !== 'published' || !lesson.isActive) {
      return null
    }

    // Step 2: Determine candidate sheet ID (lesson override or course default)
    let candidateSheetId: string | null = null

    // Check lesson-specific formula sheet first
    if (lesson.formulaSheet) {
      const lessonSheetId =
        typeof lesson.formulaSheet === 'string' ? lesson.formulaSheet : lesson.formulaSheet?.id
      if (lessonSheetId) {
        candidateSheetId = lessonSheetId
      }
    } else {
      // Fall back to course default
      const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id

      if (chapterId) {
        const chapter = (await payload.findByID({
          collection: 'chapters',
          id: chapterId,
          depth: 0,
          overrideAccess: false,
          disableErrors: true,
        })) as { course?: string | { id: string } | null } | null

        if (chapter && chapter.course) {
          const courseId = typeof chapter.course === 'string' ? chapter.course : chapter.course?.id
          if (courseId) {
            const course = (await payload.findByID({
              collection: 'courses',
              id: courseId,
              depth: 0,
              overrideAccess: false,
              disableErrors: true,
            })) as { defaultFormulaSheet?: string | { id: string } | null } | null

            if (course?.defaultFormulaSheet) {
              const courseSheetId =
                typeof course.defaultFormulaSheet === 'string'
                  ? course.defaultFormulaSheet
                  : course.defaultFormulaSheet?.id
              if (courseSheetId) {
                candidateSheetId = courseSheetId
              }
            }
          }
        }
      }
    }

    // If no candidate sheet, return null (hide button)
    if (!candidateSheetId) {
      return null
    }

    // Step 3: Try to fetch the formula sheet in requested locale
    let sheet: {
      id: string
      name: string
      locale: string
      content: unknown
      pdfFile: unknown
    } | null = null

    // Try requested locale first
    const result = await payload.find({
      collection: 'formula-sheets',
      where: {
        and: [{ id: { equals: candidateSheetId } }, { locale: { equals: locale } }],
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
      disableErrors: true,
    })

    if (result.docs.length > 0) {
      const doc = result.docs[0] as {
        id: string
        name: string
        locale: string
        content: unknown
        pdfFile: unknown
      }
      sheet = {
        id: doc.id,
        name: doc.name,
        locale: doc.locale,
        content: doc.content,
        pdfFile: doc.pdfFile,
      }
    } else if (locale === 'he') {
      // Fallback to en if he not found
      const fallbackResult = await payload.find({
        collection: 'formula-sheets',
        where: {
          and: [{ id: { equals: candidateSheetId } }, { locale: { equals: 'en' } }],
        },
        limit: 1,
        depth: 1,
        overrideAccess: true,
        disableErrors: true,
      })

      if (fallbackResult.docs.length > 0) {
        const doc = fallbackResult.docs[0] as {
          id: string
          name: string
          locale: string
          content: unknown
          pdfFile: unknown
        }
        sheet = {
          id: doc.id,
          name: doc.name,
          locale: doc.locale,
          content: doc.content,
          pdfFile: doc.pdfFile,
        }
      }
    }

    // If still not found, return null (hide button)
    if (!sheet) {
      return null
    }

    // Return the DTO
    return {
      id: sheet.id,
      name: sheet.name,
      locale: sheet.locale as ContentLocale,
      kind: sheet.pdfFile ? 'pdf' : 'richtext',
      content: sheet.content,
      pdfFile: sheet.pdfFile
        ? {
            id:
              typeof sheet.pdfFile === 'string'
                ? sheet.pdfFile
                : (sheet.pdfFile as { id?: string })?.id || '',
            url:
              typeof sheet.pdfFile === 'object'
                ? (sheet.pdfFile as { url?: string | null }).url
                : null,
            filename:
              typeof sheet.pdfFile === 'object'
                ? (sheet.pdfFile as { filename?: string | null }).filename
                : null,
          }
        : null,
      pdfStatus: 'ok',
      isEmpty: !sheet.pdfFile && sheet.content ? isRichTextEmpty(sheet.content) : false,
    }
  },
)

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
