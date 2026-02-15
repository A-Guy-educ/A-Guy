import type { CollectionBeforeValidateHook, FieldHook } from 'payload'

import { formatSlug } from '@/utilities/formatSlug'

async function getPayloadInstance() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

/**
 * Normalize whitespace in table cells to ensure consistent empty-cell detection.
 * Runs before validation to ensure schema sees normalized data.
 *
 * Rule: Whitespace-only cells (e.g., '   ') become empty strings ('').
 * This ensures consistent behavior across UI, client validation, and backend validation.
 */
export const normalizeTableCellWhitespace: CollectionBeforeValidateHook = async ({ data }) => {
  if (!data?.content?.blocks) {
    return data
  }

  // Traverse content blocks and normalize table cells
  const normalizedBlocks = data.content.blocks.map((block: any) => {
    if (block.type !== 'question_table' || !block.table?.rowsData) {
      return block
    }

    // Normalize rowsData: trim all cells, convert whitespace-only to empty string
    const normalizedRowsData = block.table.rowsData.map((row: any[]) =>
      row.map((cell: any) => {
        if (typeof cell !== 'string') return cell
        const trimmed = cell.trim()
        return trimmed === '' ? '' : trimmed
      }),
    )

    return {
      ...block,
      table: {
        ...block.table,
        rowsData: normalizedRowsData,
      },
    }
  })

  return {
    ...data,
    content: {
      ...data.content,
      blocks: normalizedBlocks,
    },
  }
}

export const generateSlug: FieldHook = async ({ value, operation, originalDoc, siblingData }) => {
  if (operation === 'delete') {
    return value
  }

  const title =
    siblingData.title || (typeof originalDoc?.title === 'string' ? originalDoc.title : null)

  if (!title) {
    return value || undefined
  }

  const payload = await getPayloadInstance()
  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    return value || formatSlug(title)
  }

  const baseSlug = value || formatSlug(title)
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await payload.find({
      collection: 'exercises',
      where: {
        and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
      },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      break
    }

    if (originalDoc?.id && existing.docs[0]?.id === originalDoc.id) {
      break
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

export const validateSlugUniqueness: FieldHook = async ({
  value,
  operation,
  originalDoc,
  siblingData,
}) => {
  if (operation === 'delete' || !value) {
    return value
  }

  const payload = await getPayloadInstance()
  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    return value
  }

  const existing = await payload.find({
    collection: 'exercises',
    where: {
      and: [{ lesson: { equals: lessonId } }, { slug: { equals: value } }],
    },
    limit: 2,
  })

  for (const doc of existing.docs) {
    if (doc.id !== originalDoc?.id) {
      throw new Error(`An exercise with this slug already exists in this lesson`)
    }
  }

  return value
}
