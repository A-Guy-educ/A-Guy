/**
 * InteractiveLessons Collection
 *
 * Read-through cache for Gemini-generated interactive lesson payloads.
 * Keyed by (user, media, locale) — if a user re-opens the same uploaded
 * image, we serve the stored lesson instead of spending Gemini tokens
 * (~$0.01 + 60-90s per generation) to reproduce it.
 *
 * Invalidation: `promptVersion` is stamped at save time. When the prompt
 * or schema changes materially, bump the INTERACTIVE_LESSON_PROMPT_VERSION
 * constant and lookups against older versions fall through to a fresh
 * generation (the old row is left untouched for audit).
 *
 * Access:
 * - Admin-only read/write via the UI (hidden from navigation).
 * - The generation service uses `overrideAccess: true` server-side for
 *   both lookup and write, since the flow is bound to the authenticated
 *   caller via the required `user` + `media` relations.
 */
import type { CollectionConfig } from 'payload'

export const InteractiveLessons: CollectionConfig = {
  slug: 'interactive-lessons',
  admin: {
    hidden: true,
    group: 'System',
    description: 'Cached Gemini responses for the Ask page interactive lesson player',
    useAsTitle: 'id',
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
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      index: true,
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      options: [
        { label: 'Hebrew', value: 'he' },
        { label: 'English', value: 'en' },
      ],
      index: true,
    },
    {
      name: 'promptVersion',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'Version tag for the prompt + schema used to generate this lesson. Bump when the prompt or response schema changes; old rows are ignored by cache lookups but kept for audit.',
      },
    },
    {
      name: 'lesson',
      type: 'json',
      required: true,
      admin: {
        description: 'Full InteractiveLesson payload as returned by the validator.',
      },
    },
    {
      name: 'model',
      type: 'text',
      admin: {
        description: 'Model name used for generation (e.g. googleai/gemini-2.5-flash).',
      },
    },
    {
      name: 'processingTimeMs',
      type: 'number',
      admin: {
        description: 'Time taken by the Gemini call, in milliseconds.',
      },
    },
  ],
  timestamps: true,
}
