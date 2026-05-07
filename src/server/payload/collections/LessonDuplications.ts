/**
 * LessonDuplications Collection
 *
 * @fileType collection-config
 * @domain lessons
 * @pattern job-record
 * @ai-summary Tracks lesson duplication requests with variation level and async processing state.
 *
 * Records every duplicate-lesson request from admins. For level=none, the
 * endpoint clones the source lesson + exercises synchronously and writes the
 * succeeded record. For light/medium/deep, the record stays pending until a
 * background variation job (later tasks) picks it up.
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'

export const DUPLICATION_LEVELS = ['none', 'light', 'medium', 'deep'] as const
export type DuplicationLevel = (typeof DUPLICATION_LEVELS)[number]

export const DUPLICATION_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'needs_review',
] as const
export type DuplicationStatus = (typeof DUPLICATION_STATUSES)[number]

export const LessonDuplications: CollectionConfig = {
  slug: 'lesson-duplications',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['sourceLesson', 'level', 'status', 'outputLesson', 'createdAt'],
    group: 'System',
    description: 'Lesson duplication job records, one per duplicate request.',
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'sourceLesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
      admin: { description: 'Lesson being duplicated.' },
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      options: DUPLICATION_LEVELS.map((v) => ({ label: v, value: v })),
      admin: { description: 'Variation level applied to the duplicate.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: DUPLICATION_STATUSES.map((v) => ({ label: v, value: v })),
      admin: { description: 'Job status. `none` finishes inline; others go through the queue.' },
    },
    {
      name: 'outputLesson',
      type: 'relationship',
      relationTo: 'lessons',
      admin: { description: 'The newly created lesson (set when status=succeeded).' },
    },
    {
      name: 'failures',
      type: 'array',
      admin: { description: 'Per-exercise validation failures (populated by later tasks).' },
      fields: [
        { name: 'exerciseRef', type: 'text' },
        { name: 'sectionIndex', type: 'number' },
        { name: 'code', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        {
          name: 'suggestedAction',
          type: 'select',
          options: [
            { label: 'skip', value: 'skip' },
            { label: 'regenerate', value: 'regenerate' },
            { label: 'keep', value: 'keep' },
          ],
        },
      ],
    },
    createdByField,
  ],
}
