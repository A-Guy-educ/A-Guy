import type { FieldHookArgs } from 'payload'

const NAME_PATTERN = /^[0-9]+ - .+ - v\d+$/
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Validates formula sheet naming convention: [Course Code] - [Topic] - [Version]
 * Example: "471 - Calc - v1"
 */
export function validateFormulaSheetName(value: unknown): true | string {
  if (!value || typeof value !== 'string') {
    return 'Name is required'
  }

  if (!NAME_PATTERN.test(value.trim())) {
    return 'Name must follow pattern: [Course Code] - [Topic] - Version (e.g., "471 - Calc - v1")'
  }

  return true
}

/**
 * Validates that at least one content source exists (content or pdfFile)
 */
export function validateFormulaSheetContent(data: Record<string, unknown>): true | string {
  const hasContent =
    data?.content &&
    typeof data.content === 'object' &&
    Object.keys(data.content as object).length > 0
  const hasPdfFile = data?.pdfFile

  if (!hasContent && !hasPdfFile) {
    return 'Formula sheet must have either rich text content or a PDF file'
  }

  return true
}

/**
 * Validates PDF file size (max 5MB) and type
 * Only runs when pdfFile is being set
 */
export async function validatePdfFile(args: FieldHookArgs): Promise<unknown> {
  const { value, req, operation } = args

  // Skip validation for non-create/update operations or if no PDF
  if (operation !== 'create' && operation !== 'update') {
    return value
  }

  if (!value) {
    return value
  }

  // If pdfFile is a string (ID), we need to fetch the media to check its properties
  const pdfId = typeof value === 'string' ? value : value?.id

  if (!pdfId) {
    return value
  }

  try {
    const mediaDoc = await req.payload.findByID({
      collection: 'media',
      id: pdfId,
      depth: 0,
      overrideAccess: true,
    })

    // Check if it's a PDF
    if (mediaDoc?.mimeType !== 'application/pdf') {
      throw new Error('Linked file must be a PDF')
    }

    // Check file size (filesize is in bytes)
    if (mediaDoc?.filesize && mediaDoc.filesize > MAX_PDF_SIZE_BYTES) {
      throw new Error('PDF file must be smaller than 5MB')
    }
  } catch {
    // If we can't verify, allow it (might be referencing a non-existent file)
    // The resolver will handle this case by returning pdfStatus: 'missing'
  }

  return value
}
