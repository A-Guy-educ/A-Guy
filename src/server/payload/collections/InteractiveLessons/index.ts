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
    // Prompt provenance — the source admin Prompts row id + its updatedAt
    // at the moment of generation. The endpoint compares these to the
    // current prompt on every read; a mismatch (admin edited the template,
    // or replaced the prompt with a different doc) evicts the cache row
    // so the next read regenerates against the latest template instead of
    // serving stale output forever.
    {
      name: 'promptId',
      type: 'text',
      required: false,
      index: true,
      admin: {
        description: 'Source admin Prompts row id at generation.',
        readOnly: true,
      },
    },
    {
      name: 'promptUpdatedAt',
      type: 'text',
      required: false,
      admin: {
        description: 'Source prompt updatedAt at generation (ISO string).',
        readOnly: true,
      },
    },
    // Bumped whenever the InteractiveLesson cached shape changes (new
    // primitive families, audio field rename, etc). Older rows with a
    // mismatched version are evicted on read so the client never sees a
    // payload shape its converter can't handle.
    {
      name: 'cacheSchemaVersion',
      type: 'text',
      required: false,
      admin: {
        description: 'Cached lesson shape version (bumped on schema change).',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
