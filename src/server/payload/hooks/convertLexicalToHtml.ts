/**
 * Hook to convert Lexical JSON to sanitized HTML
 * 
 * @fileType hook
 * @pattern lexical-conversion
 * @ai-summary Converts richText Lexical JSON to HTML and sanitizes it
 */

import type { FieldHook } from 'payload'
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
  const { convertLexicalToHTML } = await import('@payloadcms/richtext-lexical')

  try {
    // Convert Lexical JSON to HTML
    const html = await convertLexicalToHTML({ converters: [], data: lexicalData })
    
    // Sanitize the HTML
    return sanitizeHtml(html)
  } catch (error) {
    console.error('Error converting Lexical to HTML:', error)
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
): FieldHook => {
  return async ({ data, value, operation }) => {
    // Only process on create/update operations
    if (operation !== 'create' && operation !== 'update') {
      return value
    }

    // Get the Lexical data from the source field
    const lexicalData = data?.[sourceField]

    if (!lexicalData) {
      // Clear the HTML field if source is empty
      data[targetField] = ''
      return value
    }

    // Convert and store the HTML
    const html = await convertLexicalToHtml(lexicalData)
    data[targetField] = html

    return value
  }
}
