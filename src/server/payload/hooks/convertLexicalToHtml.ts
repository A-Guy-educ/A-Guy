import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'

import { sanitizeHtml } from '@/infra/utils/sanitize-html'

export const convertLexicalToHtmlBeforeChange =
  (fieldName: string, htmlFieldName: string): CollectionBeforeChangeHook =>
  async ({ data, req: _req }) => {
    const lexicalData = data[fieldName]

    if (!lexicalData) {
      return data
    }

    try {
      const html = await convertLexicalToHTML({ data: lexicalData })
      const sanitizedHtml = sanitizeHtml(html)

      return {
        ...data,
        [htmlFieldName]: sanitizedHtml,
      }
    } catch (error) {
      console.error(`Failed to convert Lexical to HTML for field ${fieldName}:`, error)
      return data
    }
  }

export const convertLexicalToHtmlAfterRead =
  (fieldName: string, htmlFieldName: string): CollectionAfterReadHook =>
  async ({ doc, req: _req }) => {
    const lexicalData = doc[fieldName as keyof typeof doc]

    if (!lexicalData) {
      return doc
    }

    try {
      const html = await convertLexicalToHTML({ data: lexicalData })
      const sanitizedHtml = sanitizeHtml(html)

      return {
        ...doc,
        [htmlFieldName]: sanitizedHtml,
      }
    } catch (error) {
      console.error(`Failed to convert Lexical to HTML for field ${fieldName}:`, error)
      return doc
    }
  }
