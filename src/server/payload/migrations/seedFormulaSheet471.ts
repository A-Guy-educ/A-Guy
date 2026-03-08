import type { Payload } from 'payload'

/**
 * Migration to seed formula sheet content for course 471 (כיתה יא - 4 יח'ל - 471)
 *
 * This migration is idempotent - it checks if the sheet already exists before creating.
 * It creates a formula sheet with name "471 - נוסחאות - v1" and attaches it as
 * the default formula sheet for course 471.
 *
 * The richText content is a minimal example with LaTeX formulas. In production,
 * this would be replaced with actual content from Figma.
 *
 * @param payload - The Payload instance
 * @returns Object with migration result status
 */
export async function seedFormulaSheet471(
  payload: Payload,
): Promise<{ created: boolean; linked: boolean; error?: string }> {
  try {
    // Step 1: Check if formula sheet already exists
    const existingSheet = await payload.find({
      collection: 'formula-sheets',
      where: {
        and: [{ name: { equals: '471 - נוסחאות - v1' } }, { locale: { equals: 'he' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    let sheetId: string

    if (existingSheet.docs.length > 0) {
      // Sheet already exists, use it
      sheetId = existingSheet.docs[0].id
      payload.logger.info({
        msg: '[seedFormulaSheet471] Formula sheet already exists, skipping creation',
      })
    } else {
      // Step 2: Create the formula sheet with basic math content
      // This is a minimal example with LaTeX - in production this would come from Figma
      const formulaSheetContent = {
        root: {
          children: [
            {
              children: [
                {
                  text: 'דף נוסחאות - כיתה יא 4 יחידות לימוד',
                  type: 'text',
                  version: 1,
                },
              ],
              type: 'heading',
              tag: 'h1',
              version: 1,
              direction: 'ltr',
              format: '',
            },
            {
              children: [
                {
                  children: [
                    {
                      text: 'נוסחאות בסיסיות',
                      type: 'text',
                      version: 1,
                    },
                  ],
                  type: 'heading',
                  tag: 'h2',
                  version: 1,
                  direction: 'ltr',
                  format: '',
                },
              ],
              type: 'paragraph',
              version: 1,
              direction: 'ltr',
              format: '',
            },
            {
              children: [
                {
                  text: 'משוואה ריבועית: ',
                  type: 'text',
                  version: 1,
                },
                {
                  text: 'x = (-b ± √(b²-4ac)) / 2a',
                  type: 'text',
                  version: 1,
                  format: 'italic',
                },
              ],
              type: 'paragraph',
              version: 1,
              direction: 'ltr',
              format: '',
            },
            {
              children: [
                {
                  text: 'נוסחאות טריגונומטריה',
                  type: 'text',
                  version: 1,
                },
              ],
              type: 'heading',
              tag: 'h2',
              version: 1,
              direction: 'ltr',
              format: '',
            },
            {
              children: [
                {
                  text: 'sin²α + cos²α = 1',
                  type: 'text',
                  version: 1,
                  format: 'italic',
                },
              ],
              type: 'paragraph',
              version: 1,
              direction: 'ltr',
              format: '',
            },
            {
              children: [
                {
                  text: 'נגזרות',
                  type: 'text',
                  version: 1,
                },
              ],
              type: 'heading',
              tag: 'h2',
              version: 1,
              direction: 'ltr',
              format: '',
            },
            {
              children: [
                {
                  text: "(f + g)' = f' + g'",
                  type: 'text',
                  version: 1,
                  format: 'italic',
                },
              ],
              type: 'paragraph',
              version: 1,
              direction: 'ltr',
              format: '',
            },
          ],
          type: 'root',
          version: 1,
        },
      }

      // Get default tenant
      const tenants = await payload.find({
        collection: 'tenants',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const tenantId = tenants.docs[0]?.id

      if (!tenantId) {
        return { created: false, linked: false, error: 'No default tenant found' }
      }

      const newSheet = await payload.create({
        collection: 'formula-sheets',
        data: {
          name: '471 - נוסחאות - v1',
          locale: 'he',
          tenant: tenantId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: formulaSheetContent as any,
        },
        overrideAccess: true,
      })

      sheetId = newSheet.id
      payload.logger.info({ msg: '[seedFormulaSheet471] Created formula sheet', sheetId })
    }

    // Step 3: Find course 471 and link the formula sheet
    // Course 471 could be identified by courseLabel containing "471" or title containing "471"
    const courses = await payload.find({
      collection: 'courses',
      where: {
        or: [
          { courseLabel: { equals: '471' } },
          { courseLabel: { contains: '471' } },
          { title: { contains: '471' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (courses.docs.length === 0) {
      payload.logger?.warn('[seedFormulaSheet471] Course 471 not found, skipping linking')
      return { created: true, linked: false, error: 'Course 471 not found' }
    }

    const course = courses.docs[0]

    // Check if already linked
    if (course.defaultFormulaSheet) {
      const existingLinkId =
        typeof course.defaultFormulaSheet === 'string'
          ? course.defaultFormulaSheet
          : course.defaultFormulaSheet?.id

      if (existingLinkId === sheetId) {
        payload.logger.info({ msg: '[seedFormulaSheet471] Formula sheet already linked to course' })
        return { created: false, linked: true }
      }
    }

    // Link the formula sheet to the course
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: {
        defaultFormulaSheet: sheetId,
      },
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[seedFormulaSheet471] Linked formula sheet to course',
      courseId: course.id,
    })

    return { created: existingSheet.docs.length === 0, linked: true }
  } catch (error) {
    payload.logger.error({ msg: '[seedFormulaSheet471] Error', error: String(error) })
    return { created: false, linked: false, error: String(error) }
  }
}
