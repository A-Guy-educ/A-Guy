/**
 * Formula Sheet Query Functions
 *
 * Resolves formula sheets for lessons with proper precedence:
 * 1. Lesson-specific formula sheet
 * 2. Course default formula sheet
 * 3. None (hide button)
 *
 * Also handles locale fallback: he → en → hide
 */

import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'

export type FormulaSheetDTO = {
  id: string
  name: string
  locale: ContentLocale
  kind: 'richtext' | 'pdf'
  content?: unknown // Lexical richText content
  pdfFile?: {
    id: string
    url?: string | null
    filename?: string | null
  } | null
  pdfStatus?: 'ok' | 'missing'
  isEmpty?: boolean
}

const DEFAULT_CONTENT_LOCALE: ContentLocale = 'he'

/**
 * Check if richText content is effectively empty
 */
function isRichTextEmpty(content: unknown): boolean {
  if (!content || typeof content !== 'object') return true

  const contentObj = content as Record<string, unknown>
  // Check for Lexical's root node structure
  if (contentObj.root && typeof contentObj.root === 'object') {
    const root = contentObj.root as Record<string, unknown>
    const children = root.children as Array<unknown> | undefined
    return !children || children.length === 0
  }

  return Object.keys(contentObj).length === 0
}

/**
 * Query formula sheet for a specific lesson
 *
 * Implements precedence: lesson formula sheet → course default → none
 * Implements locale fallback: he → en → hide (no en → he fallback)
 */
export const queryFormulaSheetForLesson = cache(
  async ({
    lessonId,
    locale = DEFAULT_CONTENT_LOCALE,
  }: {
    lessonId: string
    locale?: ContentLocale
  }): Promise<FormulaSheetDTO | null> => {
    const payload = await getPayload({ config: configPromise })

    // Step 1: Fetch the lesson to get formulaSheet reference
    // Using depth: 0 and overrideAccess: false to ensure only published lessons are resolvable
    const lesson = await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: false,
      disableErrors: true,
    })

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
      // First get the chapter to find the course
      const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id

      if (!chapterId) {
        return null
      }

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
          const course = await payload.findByID({
            collection: 'courses',
            id: courseId,
            depth: 0,
            overrideAccess: false,
            disableErrors: true,
          })

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

    // If no candidate sheet, return null (hide button)
    if (!candidateSheetId) {
      return null
    }

    // Step 3: Try to fetch the formula sheet in requested locale
    // Implement strict locale fallback: he → en → null
    // Only fallback FROM he TO en, never FROM en TO he
    let sheet = await fetchFormulaSheetById(payload, candidateSheetId, locale)

    // If not found in requested locale, try fallback
    if (!sheet && locale === DEFAULT_CONTENT_LOCALE) {
      // User is on he, fallback to en
      sheet = await fetchFormulaSheetById(payload, candidateSheetId, 'en')
    }

    // If still not found, return null (hide button)
    if (!sheet) {
      return null
    }

    // Return the DTO
    return {
      id: sheet.id,
      name: sheet.name,
      locale: sheet.locale,
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

/**
 * Fetch a formula sheet by ID for a specific locale
 */
async function fetchFormulaSheetById(
  payload: Awaited<ReturnType<typeof getPayload>>,
  sheetId: string,
  locale: ContentLocale,
): Promise<{
  id: string
  name: string
  locale: ContentLocale
  content: unknown
  pdfFile: unknown
} | null> {
  const result = await payload.find({
    collection: 'formula-sheets',
    where: {
      and: [{ id: { equals: sheetId } }, { locale: { equals: locale } }],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true, // Privileged read for formula sheets
    disableErrors: true,
  })

  if (result.docs.length === 0) {
    return null
  }

  const doc = result.docs[0] as {
    id: string
    name: string
    locale: string
    content: unknown
    pdfFile: unknown
  }
  return {
    id: doc.id,
    name: doc.name,
    locale: doc.locale as ContentLocale,
    content: doc.content,
    pdfFile: doc.pdfFile,
  }
}
