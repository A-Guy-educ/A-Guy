/**
 * InteractiveLessons Collection
 *
 * @fileType collection-config
 * @domain ai
 * @pattern content-cache
 * @ai-summary Caches the structured primitive payload Gemini returns for a given
 *             uploaded image + locale, so the expensive generation call runs at most
 *             once per (media, locale, user).
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { authenticatedOrOwner } from '../../access/authenticatedOrOwner'

export const InteractiveLessons: CollectionConfig = {
  slug: 'interactive_lessons',
  access: {
    // Users can read their own lessons. The generation endpoint writes via
    // overrideAccess, so admin-only create/update keeps the admin UI clean.
    // Delete is owner-scoped so a user can trigger a fresh regenerate by
    // removing their cached entry.
    create: adminOnly,
    read: authenticatedOrOwner,
    update: adminOnly,
    delete: authenticatedOrOwner,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'media', 'locale', 'createdAt'],
    group: 'AI',
  },
  // Compound unique index — prevents two concurrent generate requests
  // (e.g., a double-click on Generate, or a Try-Again retry racing the
  // original) from each missing the cache and creating duplicate rows.
  // The persist code below catches the duplicate-key error and silently
  // ignores it so the loser of the race becomes a cache hit.
  indexes: [
    {
      fields: ['user', 'media', 'locale'],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who triggered the generation.',
        readOnly: true,
      },
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      index: true,
      admin: {
        description: 'The uploaded image this lesson was generated from.',
        readOnly: true,
      },
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Hebrew', value: 'he' },
        { label: 'English', value: 'en' },
      ],
      admin: {
        description: 'Locale the lesson was generated in.',
        readOnly: true,
      },
    },
    {
      name: 'lesson',
      type: 'json',
      required: true,
      admin: {
        description: 'Structured InteractiveLesson payload (geometry + steps).',
        readOnly: true,
      },
    },
    {
      name: 'generationMetadata',
      type: 'json',
      required: false,
      admin: {
        description: 'Model, processing time, input size at generation.',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
