/**
 * Translation Glossary Collection
 *
 * Stores term pairs for consistent translation of educational terminology.
 * Used by the LLM translation service as reference vocabulary.
 */
import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'
import { createdByField } from '../fields/createdBy'

export const TranslationGlossary: CollectionConfig = {
  slug: 'translation-glossary',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'hebrewTerm',
    defaultColumns: ['hebrewTerm', 'englishTerm', 'subject', 'updatedAt'],
  },
  fields: [
    tenantField,
    {
      name: 'hebrewTerm',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Term in Hebrew (e.g., "יתר")',
      },
    },
    {
      name: 'englishTerm',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Term in English (e.g., "hypotenuse")',
      },
    },
    {
      name: 'subject',
      type: 'select',
      options: [
        { label: 'Mathematics', value: 'math' },
        { label: 'Science', value: 'science' },
        { label: 'General', value: 'general' },
      ],
      defaultValue: 'general',
      index: true,
      admin: {
        description: 'Subject area for this term',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Usage notes or context for translators',
      },
    },
    createdByField,
  ],
}
