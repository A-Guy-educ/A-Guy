/**
 * ContextExtractions Collection
 * Stores raw LaTeX text extracted from PDFs during the "Convert Context" procedure.
 *
 * @fileType collection-config
 * @domain content-pipeline
 * @pattern hidden-storage
 * @ai-summary Hidden storage for PDF-to-LaTeX extraction output, decoupled from lessonContextText
 *
 * Purpose:
 * - Holds the raw LaTeX extraction that was previously stored in Lesson.lessonContextText
 * - The ContextExerciseViewer reads from this collection to display/edit parsed exercises
 * - The create-context-exercises API reads from this to create Exercise documents
 * - Lesson.lessonContextText was previously used for chat context injection (now removed)
 *
 * Access:
 * - Admin-only read/write (extraction is triggered from admin panel)
 * - Not visible in admin navigation (admin.hidden: true)
 */
import type { CollectionConfig } from 'payload'

export const ContextExtractions: CollectionConfig = {
  slug: 'context-extractions',
  admin: {
    hidden: true,
    group: 'System',
    description: 'Raw LaTeX extractions from PDFs for exercise creation',
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      return req.user.collection === 'users' && req.user.role === 'admin'
    },
    create: ({ req }) => {
      if (!req.user) return false
      return req.user.collection === 'users' && req.user.role === 'admin'
    },
    update: ({ req }) => {
      if (!req.user) return false
      return req.user.collection === 'users' && req.user.role === 'admin'
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return req.user.collection === 'users' && req.user.role === 'admin'
    },
  },
  fields: [
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
    },
    {
      name: 'sourceMedia',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'The PDF or image this extraction was created from',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      maxLength: 200_000,
      admin: {
        description:
          'LaTeX rendering of the structured exercises. Generated for the viewer; the structured `exercises` field is the source of truth.',
      },
    },
    {
      name: 'exercises',
      type: 'json',
      admin: {
        description:
          'Structured exercises returned by schema-mode extraction: [{ number, latex, solution }]. Stage 2 (create-context-exercises) reads this directly when present.',
      },
    },
  ],
  timestamps: true,
}
