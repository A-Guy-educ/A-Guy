/**
 * LessonDuplications Collection
 *
 * @fileType collection-config
 * @domain lessons
 * @pattern job-record
 * @ai-summary Tracks lesson duplication requests with variation level and async processing state.
 *
 * This is a job-record collection. Admins should not be editing rows here —
 * the proper review UI lives at /admin/lesson-duplications/<id>, which knows
 * how to skip/regenerate/keep individual failures. Most fields are marked
 * readOnly in this admin view so accidental edits in the raw collection don't
 * corrupt the pipeline state.
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'

export const DUPLICATION_LEVELS = ['none', 'light', 'medium', 'deep'] as const
export type DuplicationLevel = (typeof DUPLICATION_LEVELS)[number]

export const DUPLICATION_SUBJECTS = ['algebra', 'geometry', 'calculus', 'mixed', 'other'] as const
export type DuplicationSubject = (typeof DUPLICATION_SUBJECTS)[number]

export const DUPLICATION_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'needs_review',
] as const
export type DuplicationStatus = (typeof DUPLICATION_STATUSES)[number]

/** Shape of a single failure / warning entry — shared by both arrays. */
const REVIEW_ENTRY_FIELDS = [
  { name: 'exerciseRef', type: 'text', admin: { readOnly: true } },
  { name: 'sectionIndex', type: 'number', admin: { readOnly: true } },
  { name: 'code', type: 'text', required: true, admin: { readOnly: true } },
  { name: 'message', type: 'text', required: true, admin: { readOnly: true } },
  {
    name: 'suggestedAction',
    type: 'select',
    options: [
      { label: 'skip', value: 'skip' },
      { label: 'regenerate', value: 'regenerate' },
      { label: 'keep', value: 'keep' },
    ],
    admin: {
      readOnly: true,
      description:
        'Pipeline-suggested default action. Actual action is chosen by the admin in the review screen at /admin/lesson-duplications/<id>.',
    },
  },
  {
    name: 'resolved',
    type: 'checkbox',
    defaultValue: false,
    admin: {
      readOnly: true,
      description: 'Set automatically by the review screen when the admin completes an action.',
    },
  },
] as const

export const LessonDuplications: CollectionConfig = {
  slug: 'lesson-duplications',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['sourceLesson', 'level', 'subject', 'status', 'outputLesson', 'createdAt'],
    group: 'System',
    description:
      'Job records for the lesson-duplication pipeline. Use the review screen at /admin/lesson-duplications/<id> to skip / regenerate / keep individual exercise failures.',
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
      admin: { description: 'Lesson being duplicated.', readOnly: true },
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      options: DUPLICATION_LEVELS.map((v) => ({ label: v, value: v })),
      admin: { description: 'Variation level applied to the duplicate.', readOnly: true },
    },
    {
      name: 'subject',
      type: 'select',
      options: DUPLICATION_SUBJECTS.map((v) => ({ label: v, value: v })),
      admin: { description: 'Subject area for variation prompts.', readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: DUPLICATION_STATUSES.map((v) => ({ label: v, value: v })),
      admin: {
        description:
          'Job status managed by the pipeline. `none` finishes inline; others go through the queue.',
        readOnly: true,
      },
    },
    {
      name: 'outputLesson',
      type: 'relationship',
      relationTo: 'lessons',
      admin: {
        description: 'The newly created lesson (set when status=succeeded).',
        readOnly: true,
      },
    },
    {
      name: 'failures',
      type: 'array',
      admin: {
        description:
          'Blocking failures — these exercises were dropped from the output lesson and need manual handling.',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: [...REVIEW_ENTRY_FIELDS] as any,
    },
    {
      name: 'warnings',
      type: 'array',
      admin: {
        description:
          'Non-blocking warnings — the exercise was kept with placeholder text for the missing field(s). Admin can polish from the review screen.',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: [...REVIEW_ENTRY_FIELDS] as any,
    },
    {
      name: 'outputExercises',
      type: 'array',
      admin: {
        description: 'Maps source exercise IDs to their generated output exercise IDs.',
        readOnly: true,
      },
      fields: [
        { name: 'sourceExerciseId', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'outputExerciseId', type: 'text', required: true, admin: { readOnly: true } },
        {
          name: 'strategy',
          type: 'select',
          options: [
            { label: 'script', value: 'script' },
            { label: 'ai', value: 'ai' },
          ],
          required: true,
          admin: { readOnly: true },
        },
      ],
    },
    createdByField,
  ],
}
