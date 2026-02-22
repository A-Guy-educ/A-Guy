/**
 * Hook to convert Lexical JSON to sanitized HTML
 * 
 * @fileType hook
 * @pattern lexical-conversion
 * @ai-summary Converts richText Lexical JSON to HTML and sanitizes it
 */

import type { CollectionBeforeChangeHook } from 'payload'
import { sanitizeHtml } from '@/infra/utils/sanitize-html'

/**
 * Converts Lexical editor state to sanitized HTML
 * Use in beforeChange hooks on collections with richText fields
 */
export const convertLexicalToHtml = async (lexicalData: any): Promise<string> => {
  if (!lexicalData) {
    return ''
  }

  // Import the HTML converter from Payload
  const { convertLexicalToHTML } = await import('@payloadcms/richtext-lexical/html')

  try {
    // Convert Lexical JSON to HTML using default converters
    const html = await convertLexicalToHTML({ data: lexicalData })
    
    // Sanitize the HTML
    return sanitizeHtml(html)
  } catch (error) {
    return ''
  }
}

/**
 * Factory function to create a beforeChange hook for a specific richText field
 * @param sourceField - Name of the richText field (e.g., 'description')
 * @param targetField - Name of the HTML output field (e.g., 'descriptionHtml')
 */
export const createLexicalToHtmlHook = (
  sourceField: string,
  targetField: string,
): CollectionBeforeChangeHook => {
  return async ({ data, operation }) => {
    // Only process on create/update operations
    if (operation !== 'create' && operation !== 'update') {
      return
    }

    // Get the Lexical data from the source field
    const lexicalData = data?.[sourceField]

    if (!lexicalData) {
      // Clear the HTML field if source is empty
      data[targetField] = ''
      return
    }

    // Convert and store the HTML
    const html = await convertLexicalToHtml(lexicalData)
    data[targetField] = html
  }
}

/**
 * Factory function to create an afterRead hook for backward compatibility
 * Computes HTML from Lexical JSON if HTML field is empty (doesn't write to DB)
 * @param sourceField - Name of the richText field (e.g., 'description')
 * @param targetField - Name of the HTML output field (e.g., 'descriptionHtml')
 */
export const createLexicalToHtmlAfterReadHook = (
  sourceField: string,
  targetField: string,
): CollectionBeforeChangeHook => {
  return async ({ doc }) => {
    // If HTML field is empty but Lexical JSON exists, compute HTML for response
    if (!doc?.[targetField] && doc?.[sourceField]) {
      const html = await convertLexicalToHtml(doc[sourceField])
      doc[targetField] = html
    }
  }
}
