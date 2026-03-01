/**
 * ExtractionLogs Collection
 *
 * Stores extraction logs for V3 single-exercise conversion.
 * Tracks raw LLM responses, parsed payloads, and lifecycle stages.
 *
 * @fileType collection-config
 * @domain conversion
 * @pattern append-only-log
 */
import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { tenantField } from '@/server/payload/fields/tenant'

export const ExtractionLogs: CollectionConfig = {
  slug: 'extraction-logs',
  access: {
    // Not creatable from admin UI - server-side creation uses overrideAccess: true
    create: () => false,
    // Admin-only read access
    read: adminOnly,
    // Append-only: no updates allowed
    update: () => false,
    // Append-only: no deletes allowed
    delete: () => false,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['id', 'status', 'stage', 'lesson', 'media', 'pipelineVersion', 'createdAt'],
    group: 'AI',
  },
  fields: [
    // Tenant
    tenantField,

    // Source relationships
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
      admin: {
        description: 'Lesson from which this extraction was triggered',
      },
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      index: true,
      admin: {
        description: 'Source document (PDF or image) that was extracted',
      },
    },
    {
      name: 'exercise',
      type: 'relationship',
      relationTo: 'exercises',
      required: false,
      admin: {
        description: 'Exercise created from this extraction (populate on create-stage success)',
      },
    },
    // Prompt used
    {
      name: 'prompt',
      type: 'relationship',
      relationTo: 'prompts',
      required: false,
      admin: {
        description: 'Prompt used for extraction',
      },
    },
    {
      name: 'promptVersion',
      type: 'text',
      required: false,
      admin: {
        description: 'Immutable version marker (e.g., prompt.key:prompt.updatedAt)',
      },
    },

    // Status and stage
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
      index: true,
      admin: {
        description: 'Extraction result status',
      },
    },
    {
      name: 'stage',
      type: 'select',
      required: true,
      options: [
        { label: 'Extract', value: 'extract' },
        { label: 'Create', value: 'create' },
      ],
      index: true,
      admin: {
        description: 'Lifecycle stage - extract or create',
      },
    },

    // Response data
    {
      name: 'rawResponse',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Raw LLM response string',
        rows: 10,
      },
    },
    {
      name: 'parsedPayload',
      type: 'json',
      required: false,
      admin: {
        description: 'Parsed JSON from LLM',
      },
    },
    {
      name: 'errorMessage',
      type: 'text',
      required: false,
      admin: {
        description: 'Error details if extraction failed',
      },
    },

    // Metadata
    {
      name: 'pipelineVersion',
      type: 'number',
      required: true,
      defaultValue: 3,
      admin: {
        description: 'Pipeline version used (V3 = 3)',
      },
    },
    {
      name: 'processingTimeMs',
      type: 'number',
      required: false,
      admin: {
        description: 'Extraction duration in milliseconds',
      },
    },
    {
      name: 'model',
      type: 'text',
      required: false,
      admin: {
        description: 'LLM model name used',
      },
    },
  ],
  timestamps: true,
}
