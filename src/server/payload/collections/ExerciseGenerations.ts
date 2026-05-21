/**
 * ExerciseGenerations Collection
 *
 * @fileType collection-config
 * @domain exercises
 * @pattern job-record
 * @ai-summary Tracks AI exercise generation requests with resumable processing state.
 *
 * This is a job-record collection. Admins should not be editing rows here —
 * the proper review UI lives at /admin/exercise-generations/<id>, which knows
 * how to skip/regenerate/keep individual failures. Most fields are marked
 * readOnly in this admin view so accidental edits in the raw collection don't
 * corrupt the pipeline state.
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'

export const GENERATION_DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const
export type GenerationDifficultyLevel = (typeof GENERATION_DIFFICULTY_LEVELS)[number]

export const GENERATION_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'needs_review',
] as const
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]

/** Shape of a single failure entry. */
const FAILURE_ENTRY_FIELDS = [
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
    },
  },
  {
    name: 'resolved',
    type: 'checkbox',
    defaultValue: false,
    admin: {
      readOnly: true,
    },
  },
] as const

export const ExerciseGenerations: CollectionConfig = {
  slug: 'exercise-generations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['lesson', 'prompt', 'maxCount', 'difficultyLevel', 'status', 'createdAt'],
    group: 'System',
    description:
      'Job records for the AI exercise generation pipeline. Use the review screen at /admin/exercise-generations/<id> to manage failures.',
    components: {
      edit: {
        beforeDocumentControls: [
          '@/ui/admin/ExerciseGenerationReview/ReviewLinkButton#ExerciseGenerationReviewLink',
        ],
      },
    },
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
      admin: { description: 'Lesson to add exercises to.', readOnly: true },
    },
    {
      name: 'prompt',
      type: 'textarea',
      required: true,
      admin: { description: 'User-provided prompt for generating exercises.', readOnly: true },
    },
    {
      name: 'maxCount',
      type: 'number',
      required: true,
      defaultValue: 10,
      admin: { description: 'Number of exercises to generate.', readOnly: true },
    },
    {
      name: 'difficultyLevel',
      type: 'select',
      required: true,
      options: GENERATION_DIFFICULTY_LEVELS.map((v) => ({ label: v, value: v })),
      defaultValue: 'medium',
      admin: { description: 'Difficulty level for generated exercises.', readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: GENERATION_STATUSES.map((v) => ({ label: v, value: v })),
      admin: {
        description: 'Job status managed by the pipeline.',
        readOnly: true,
      },
    },
    {
      name: 'failures',
      type: 'array',
      admin: {
        description: 'Blocking failures — these exercises were not generated successfully.',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: [...FAILURE_ENTRY_FIELDS] as any,
    },
    {
      name: 'outputExercises',
      type: 'array',
      admin: {
        description: 'Maps generated exercise IDs to their positions.',
        readOnly: true,
      },
      fields: [
        { name: 'exerciseId', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'position', type: 'number', required: true, admin: { readOnly: true } },
      ],
    },
    // ── AI Telemetry ─────────────────────────────────────────────────────────────
    {
      name: 'aiTokensInput',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Total input tokens consumed across all LLM calls.',
      },
    },
    {
      name: 'aiTokensOutput',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Total output tokens generated across all LLM calls.',
      },
    },
    {
      name: 'aiCostUsd',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Estimated USD cost of all LLM calls.',
      },
    },
    {
      name: 'runDurationMs',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Wall-clock duration of the generation run in milliseconds.',
      },
    },
    // ── Stuck Record Detection ──────────────────────────────────────────────────
    {
      name: 'claimAttempts',
      type: 'number',
      defaultValue: 0,
      admin: {
        description:
          'Number of consecutive cron ticks that claimed this record without producing any new exercises. Reset to 0 when output grows. Auto-fails at ≥ 5.',
        readOnly: true,
      },
    },
    createdByField,
  ],
}
