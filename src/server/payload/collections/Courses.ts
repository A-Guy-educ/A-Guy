/**
 * Courses Collection
 *
 * @fileType collection-config
 * @domain courses
 * @pattern published-content, hierarchical-data
 * @ai-summary Courses collection with chapters relationship and published state
 */

import type { CollectionConfig } from 'payload'

import type { Access } from 'payload'

import { DEFAULT_ACCESS_TYPE, DEFAULT_PAGE_ACCESS_TYPE } from '@/server/constants/access-types'
import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { cascadeAdminTitle } from '../hooks/courses/cascadeAdminTitle'

/**
 * Status-aware read access: anonymous users see only published content,
 * authenticated users see all content (draft/published/archived)
 */
const publishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
}

const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()

export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: publishedOrAuthenticated,
    update: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.title && !data?.slug) {
          data.slug = formatSlug(data.title)
        }
        return data
      },
    ],
    afterChange: [cascadeAdminTitle],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'courseLabel',
      'title',
      'categories',
      'slug',
      'order',
      'status',
      'isActive',
      'updatedAt',
    ],
  },
  fields: [
    // Tenant
    tenantField,
    {
      name: 'courseLabel',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Course identifier (e.g., "ח" or "8")',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Display title (e.g., "Course 8 Math")',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Detailed description of the course',
        components: {
          Field: '@/ui/admin/QuillField#QuillField',
        },
      },
    },
    {
      name: 'mediaFiles',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Upload course-related media files (images, videos, documents, etc.)',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Sort order for UI display',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'draft',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
        {
          label: 'Archived',
          value: 'archived',
        },
      ],
      admin: {
        description: 'Publication status of the course',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this course is currently active',
      },
    },
    {
      name: 'pageAccessType',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_PAGE_ACCESS_TYPE,
      options: [
        { label: 'Free Access', value: 'free' },
        { label: 'Require Registration', value: 'mandatory' },
        { label: 'Gated (5-Minute Delay)', value: 'gated' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Controls access to the course page itself (study/practice view). "Gated" shows a sign-in prompt after a configurable delay.',
      },
    },
    {
      name: 'accessType',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_ACCESS_TYPE,
      options: [
        { label: 'Free Access', value: 'free' },
        { label: 'Require Registration', value: 'mandatory' },
        { label: 'Gated (5-Minute Delay)', value: 'gated' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Default access type for lessons in this course. Lessons can override with their own setting.',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      hasMany: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'prompt',
      type: 'relationship',
      relationTo: 'prompts',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'AI system prompt for Ask tab chat in this course (uses default if not set)',
      },
    },
    {
      name: 'courseContextText',
      type: 'textarea',
      maxLength: 100_000,
      admin: {
        description:
          'AI context text for this course. Injected into Ask tab chat prompts at runtime.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      index: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier (auto-generated from title if empty)',
      },
    },
    {
      name: 'meta',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'description',
          type: 'textarea',
        },
      ],
    },

    // Created By
    createdByField,
  ],
}
