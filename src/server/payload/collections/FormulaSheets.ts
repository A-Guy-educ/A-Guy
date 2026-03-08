/**
 * Formula Sheets Collection
 *
 * Stores formula sheets (math equations/formulas) that can be attached to courses or lessons.
 * Supports both rich text content with LaTeX and PDF file formats.
 *
 * @fileType collection-config
 * @domain courses
 * @pattern published-content
 * @ai-summary Formula sheets collection for storing math formulas with LaTeX or PDF support
 */

import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { contentLocaleField } from '@/server/payload/fields/contentLocale'
import { adminOnly } from '../access/adminOnly'
import {
  validateFormulaSheetName,
  validateFormulaSheetContent,
  validatePdfFile,
} from './FormulaSheets/validateFormulaSheet'

export const FormulaSheets: CollectionConfig = {
  slug: 'formula-sheets',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // Validate naming pattern
        if (data?.name) {
          const nameValidation = validateFormulaSheetName(data.name)
          if (nameValidation !== true) {
            throw new Error(nameValidation)
          }
        }

        // Validate at least one content source exists
        if (data) {
          const contentValidation = validateFormulaSheetContent(data)
          if (contentValidation !== true) {
            throw new Error(contentValidation)
          }
        }

        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'locale', 'tenant', 'updatedAt'],
    group: 'Content',
  },
  fields: [
    // Tenant
    tenantField,
    // Content locale
    contentLocaleField,
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'Name following pattern: [Course Code] - [Topic] - [Version] (e.g., 471 - Calc - v1)',
      },
      validate: validateFormulaSheetName,
    },
    {
      name: 'content',
      type: 'richText',
      required: false,
      admin: {
        description: 'Rich text content with LaTeX support for formulas',
      },
    },
    {
      name: 'pdfFile',
      type: 'relationship',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'PDF file containing formula sheet (max 5MB)',
      },
      hooks: {
        beforeValidate: [validatePdfFile],
      },
    },
  ],
  timestamps: true,
}
