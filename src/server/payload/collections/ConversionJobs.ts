import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { approveAllHandler } from '../endpoints/conversion-jobs/approve-all'
import { approveStageHandler } from '../endpoints/conversion-jobs/approve-stage'
import { cancelConversionHandler } from '../endpoints/conversion-jobs/cancel'
import { editExerciseHandler } from '../endpoints/conversion-jobs/edit-exercise'
import { finalizeHandler } from '../endpoints/conversion-jobs/finalize'
import { pauseConversionHandler } from '../endpoints/conversion-jobs/pause'
import { previewHandler } from '../endpoints/conversion-jobs/preview'
import { resumeConversionHandler } from '../endpoints/conversion-jobs/resume'
import { retryConversionHandler } from '../endpoints/conversion-jobs/retry'
import { startConversionHandler } from '../endpoints/conversion-jobs/start'
import { streamHandler } from '../endpoints/conversion-jobs/stream'
import { tenantField } from '../fields/tenant'

export const ConversionJobs: CollectionConfig = {
  slug: 'conversion-jobs',

  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'lesson', 'progress', 'createdAt'],
    group: 'Tools',
  },

  fields: [
    // ===== Identification =====
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Auto-generated: "{Lesson Title} - {PDF Name}"' },
    },
    {
      name: 'payloadJobId',
      type: 'text',
      index: true,
      admin: { description: 'Reference to payload-jobs collection _id' },
    },

    // ===== Source References =====
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
    },
    {
      name: 'sourceMedia',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      admin: { description: 'Source PDF file' },
    },
    tenantField,

    // ===== Status & Progress =====
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      admin: {
        description:
          'Job status. Draft jobs are not yet started. Use the "Start" button to begin processing.',
      },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Queued', value: 'queued' },
        { label: 'Running', value: 'running' },
        { label: 'Paused', value: 'paused' },
        { label: 'Review', value: 'review' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },

    // ===== Progress Tracking =====
    {
      name: 'progress',
      type: 'group',
      fields: [
        {
          name: 'currentStage',
          type: 'select',
          admin: { description: 'Current processing stage' },
          options: [
            { label: 'Init', value: 'INIT' },
            { label: 'PDF Preview', value: 'PDF_PREVIEW' },
            { label: 'Configuration', value: 'CONFIGURATION' },
            { label: 'PDF Load', value: 'PDF_LOAD' },
            { label: 'PDF Segment', value: 'PDF_SEGMENT' },
            { label: 'Segment Queue', value: 'SEGMENT_QUEUE' },
            { label: 'Segment Extract', value: 'SEGMENT_EXTRACT' },
            { label: 'Segment Review', value: 'SEGMENT_REVIEW' },
            { label: 'Round Processing', value: 'ROUND_PROCESSING' },
            { label: 'Segment Verify', value: 'SEGMENT_VERIFY' },
            { label: 'Verification Review', value: 'VERIFICATION_REVIEW' },
            { label: 'Segment Persist', value: 'SEGMENT_PERSIST' },
            { label: 'Final Approval', value: 'FINAL_APPROVAL' },
            { label: 'Complete', value: 'COMPLETE' },
            { label: 'Failed', value: 'FAILED' },
            { label: 'Cancelled', value: 'CANCELLED' },
            { label: 'Paused', value: 'PAUSED' },
          ],
        },
        {
          name: 'currentStageMessage',
          type: 'text',
          admin: { description: 'Human-readable stage status' },
        },
        { name: 'totalPages', type: 'number', defaultValue: 0 },
        { name: 'processedPages', type: 'number', defaultValue: 0 },
        { name: 'totalSegments', type: 'number', defaultValue: 0 },
        { name: 'completedSegments', type: 'number', defaultValue: 0 },
        { name: 'failedSegments', type: 'number', defaultValue: 0 },
        { name: 'totalExercises', type: 'number', defaultValue: 0 },
        { name: 'approvedExercises', type: 'number', defaultValue: 0 },
        { name: 'rejectedExercises', type: 'number', defaultValue: 0 },
        { name: 'skippedExercises', type: 'number', defaultValue: 0 },
        { name: 'dedupedExercises', type: 'number', defaultValue: 0 },
      ],
    },

    // ===== Configuration =====
    {
      name: 'config',
      type: 'group',
      fields: [
        // Page range selection
        {
          name: 'pageRange',
          type: 'group',
          fields: [
            { name: 'start', type: 'number', defaultValue: 1, min: 1 },
            { name: 'end', type: 'number', admin: { description: 'Leave empty for all pages' } },
            { name: 'excludePages', type: 'json', defaultValue: [] },
          ],
        },
        // Segmentation settings
        {
          name: 'segmentation',
          type: 'group',
          fields: [
            { name: 'pagesPerSegment', type: 'number', defaultValue: 2, min: 1, max: 10 },
            { name: 'customBoundaries', type: 'json', defaultValue: [] },
          ],
        },
        // Extraction settings
        {
          name: 'extraction',
          type: 'group',
          fields: [
            {
              name: 'mode',
              type: 'select',
              defaultValue: 'structured',
              options: [
                { label: 'Structured Only', value: 'structured' },
                { label: 'Flexible', value: 'flexible' },
              ],
            },
            {
              name: 'exerciseTypes',
              type: 'select',
              hasMany: true,
              defaultValue: ['mcq', 'free_response', 'select'],
              options: [
                { label: 'Multiple Choice', value: 'mcq' },
                { label: 'Free Response', value: 'free_response' },
                { label: 'Selection', value: 'select' },
                { label: 'Fill in Blank', value: 'fill_blank' },
                { label: 'Matching', value: 'matching' },
              ],
            },
            { name: 'customInstructions', type: 'textarea' },
          ],
        },
        // Review settings
        {
          name: 'reviewMode',
          type: 'select',
          defaultValue: 'segment',
          options: [
            { label: 'Auto-approve All', value: 'auto' },
            { label: 'Review After Each Segment', value: 'segment' },
            { label: 'Review All at End', value: 'batch' },
            { label: 'Manual Step-by-Step', value: 'manual' },
          ],
        },
      ],
    },

    // ===== Prompts =====
    {
      name: 'prompts',
      type: 'group',
      fields: [
        {
          name: 'extractor',
          type: 'relationship',
          relationTo: 'prompts',
          required: true,
          filterOptions: { usage: { equals: 'extractor' }, status: { equals: 'published' } },
        },
        {
          name: 'verifier',
          type: 'relationship',
          relationTo: 'prompts',
          required: true,
          filterOptions: { usage: { equals: 'verifier' }, status: { equals: 'published' } },
        },
        // Snapshots for immutability
        {
          name: 'extractorSnapshot',
          type: 'group',
          fields: [
            { name: 'template', type: 'textarea' },
            { name: 'hash', type: 'text' },
            { name: 'capturedAt', type: 'date' },
          ],
        },
        {
          name: 'verifierSnapshot',
          type: 'group',
          fields: [
            { name: 'template', type: 'textarea' },
            { name: 'hash', type: 'text' },
            { name: 'capturedAt', type: 'date' },
          ],
        },
      ],
    },

    // ===== Additional Rounds =====
    {
      name: 'additionalRounds',
      type: 'array',
      admin: { description: 'Additional extraction/enrichment rounds per exercise' },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'prompt', type: 'relationship', relationTo: 'prompts', required: true },
        { name: 'targetField', type: 'text', required: true },
        {
          name: 'triggerCondition',
          type: 'select',
          defaultValue: 'always',
          options: [
            { label: 'Always', value: 'always' },
            { label: 'Has Image', value: 'has_image' },
            { label: 'Has Table', value: 'has_table' },
            { label: 'Has Diagram', value: 'has_diagram' },
            { label: 'Custom', value: 'custom' },
          ],
        },
        { name: 'customCondition', type: 'code' },
        { name: 'order', type: 'number', required: true, defaultValue: 1 },
        { name: 'isEnabled', type: 'checkbox', defaultValue: true },
        {
          name: 'promptSnapshot',
          type: 'group',
          fields: [
            { name: 'template', type: 'textarea' },
            { name: 'hash', type: 'text' },
          ],
        },
      ],
    },

    // ===== Segments =====
    {
      name: 'segments',
      type: 'array',
      admin: { description: 'Processing state per segment' },
      fields: [
        { name: 'index', type: 'number', required: true },
        { name: 'pageStart', type: 'number', required: true },
        { name: 'pageEnd', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Processing', value: 'processing' },
            { label: 'Extracted', value: 'extracted' },
            { label: 'Review', value: 'review' },
            { label: 'Verified', value: 'verified' },
            { label: 'Completed', value: 'completed' },
            { label: 'Failed', value: 'failed' },
            { label: 'Skipped', value: 'skipped' },
          ],
        },
        { name: 'exerciseCount', type: 'number', defaultValue: 0 },
        { name: 'errorMessage', type: 'text' },
        { name: 'processedAt', type: 'date' },
      ],
    },

    // ===== Pending Exercises (Review Queue) =====
    {
      name: 'pendingExercises',
      type: 'array',
      admin: { description: 'Exercises awaiting review/approval' },
      fields: [
        { name: 'segmentIndex', type: 'number', required: true },
        { name: 'orderInSegment', type: 'number', required: true },
        { name: 'title', type: 'text' },
        { name: 'content', type: 'json' },
        { name: 'enrichments', type: 'json' },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Edited', value: 'edited' },
            { label: 'Skipped', value: 'skipped' },
          ],
        },
        { name: 'verificationResult', type: 'json' },
        { name: 'verificationMessage', type: 'text' },
        { name: 'adminNotes', type: 'textarea' },
        { name: 'savedExerciseId', type: 'text' },
        {
          name: 'scores',
          type: 'group',
          fields: [
            { name: 'confidence', type: 'number', min: 0, max: 1 },
            { name: 'completeness', type: 'number', min: 0, max: 1 },
            { name: 'complexity', type: 'number', min: 0, max: 1 },
            { name: 'duplicateLikelihood', type: 'number', min: 0, max: 1 },
          ],
        },
      ],
    },

    // ===== Logs =====
    {
      name: 'logs',
      type: 'array',
      admin: { description: 'Structured execution logs' },
      fields: [
        { name: 'timestamp', type: 'date', required: true },
        { name: 'level', type: 'select', options: ['info', 'warn', 'error'], required: true },
        { name: 'stage', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        { name: 'details', type: 'json' },
      ],
    },

    // ===== Errors =====
    {
      name: 'jobErrors',
      type: 'array',
      admin: { description: 'Conversion errors encountered during processing' },
      fields: [
        { name: 'stage', type: 'text' },
        { name: 'code', type: 'text' },
        { name: 'message', type: 'text' },
        { name: 'details', type: 'json' },
        { name: 'timestamp', type: 'date' },
      ],
    },

    // ===== Timing =====
    { name: 'startedAt', type: 'date' },
    { name: 'pausedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
    { name: 'totalDurationMs', type: 'number' },

    // ===== Template Reference =====
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'conversion-templates',
      admin: { description: 'Template used to create this job' },
    },

    // ===== Completed Exercises =====
    {
      name: 'completedExercises',
      type: 'array',
      admin: { description: 'Approved and persisted exercises' },
      fields: [
        { name: 'segmentIndex', type: 'number', required: true },
        { name: 'orderInSegment', type: 'number', required: true },
        { name: 'title', type: 'text' },
        { name: 'content', type: 'json' },
        { name: 'enrichments', type: 'json' },
        {
          name: 'status',
          type: 'select',
          options: ['approved', 'edited', 'skipped'],
        },
        { name: 'verificationResult', type: 'json' },
        { name: 'adminNotes', type: 'textarea' },
        { name: 'savedExerciseId', type: 'text' },
        { name: 'approvedAt', type: 'date' },
      ],
    },

    // ===== Finalization =====
    {
      name: 'isFinalized',
      type: 'checkbox',
      admin: { description: 'Job has been finalized' },
    },
    {
      name: 'finalizedAt',
      type: 'date',
      admin: { description: 'When job was finalized' },
    },
    {
      name: 'summary',
      type: 'json',
      admin: { description: 'Final conversion summary' },
    },

    // ===== Audit =====
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
  ],

  timestamps: true,

  indexes: [
    { fields: ['status', 'createdAt'] },
    { fields: ['lesson', 'status'] },
    { fields: ['tenant', 'status'] },
  ],

  endpoints: [
    {
      path: '/:id/start',
      method: 'post',
      handler: startConversionHandler,
    },
    {
      path: '/:id/pause',
      method: 'post',
      handler: pauseConversionHandler,
    },
    {
      path: '/:id/resume',
      method: 'post',
      handler: resumeConversionHandler,
    },
    {
      path: '/:id/cancel',
      method: 'post',
      handler: cancelConversionHandler,
    },
    {
      path: '/:id/retry',
      method: 'post',
      handler: retryConversionHandler,
    },
    {
      path: '/:id/approve-stage',
      method: 'post',
      handler: approveStageHandler,
    },
    {
      path: '/:id/approve-all',
      method: 'post',
      handler: approveAllHandler,
    },
    {
      path: '/:id/finalize',
      method: 'post',
      handler: finalizeHandler,
    },
    {
      path: '/:id/stream',
      method: 'get',
      handler: streamHandler,
    },
    {
      path: '/:id/preview',
      method: 'get',
      handler: previewHandler,
    },
    {
      path: '/:id/exercises/:exerciseId/edit',
      method: 'post',
      handler: editExerciseHandler,
    },
  ],
}
