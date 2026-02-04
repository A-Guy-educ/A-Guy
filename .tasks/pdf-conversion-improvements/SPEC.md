# PDF Conversion System v2 - Technical Specification

## Overview

This specification defines a comprehensive multi-step PDF-to-exercises conversion system with:

1. **Dedicated Conversion Page** - Standalone admin UI (like Media library)
2. **Multi-Round Extraction** - Additional AI processing rounds per exercise
3. **Admin Control Points** - Review gates at each stage
4. **Real-Time Observability** - SSE streaming, structured logging

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Models](#2-data-models)
3. [Workflow Stages](#3-workflow-stages)
4. [API Endpoints](#4-api-endpoints)
5. [UI Components](#5-ui-components)
6. [Multi-Round Extraction](#6-multi-round-extraction)
7. [Migration Strategy](#7-migration-strategy)

---

## 1. Architecture Overview

### Current vs Proposed

| Aspect | Current (v1) | Proposed (v2) |
|--------|--------------|---------------|
| **Entry Point** | Embedded in Lesson edit | Standalone `/admin/conversions` |
| **Job State** | Fire-and-forget | Pausable, resumable with review gates |
| **Extraction** | Single extractor prompt | Multi-round with enrichment |
| **Admin Control** | Select prompts only | Full configuration wizard |
| **Observability** | 10s polling | Real-time SSE streaming |
| **Review** | Post-completion only | Per-segment, per-exercise review |

### Key Architecture Decision: Separation of State and Execution

**Problem:** Payload's built-in `payload-jobs` collection is inflexible:
- Limited schema customization
- No support for rich state management (review queues, pending exercises)
- Difficult to add custom fields or modify behavior
- Internal implementation may change between Payload versions

**Solution:** Two-layer architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      STATE LAYER (Our Control)                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              ConversionJobs Collection                         │  │
│  │  - Full schema control                                         │  │
│  │  - Rich state: status, stages, review queues, pending items    │  │
│  │  - Configuration: prompts, rounds, page ranges                 │  │
│  │  - Progress tracking: segments, exercises, logs                │  │
│  │  - All queries and UI read from here                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              │ payloadJobId (optional reference)     │
│                              ↓                                       │
├─────────────────────────────────────────────────────────────────────┤
│                    EXECUTION LAYER (Payload's)                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              payload-jobs Collection                           │  │
│  │  - Used ONLY for task queue execution                         │  │
│  │  - Thin wrapper: just triggers the task handler               │  │
│  │  - We don't query this directly                               │  │
│  │  - Task handler reads/writes to ConversionJobs                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
1. **Full control** - We own the schema, can add any fields
2. **Decoupled** - If Payload changes job internals, we're unaffected
3. **Queryable** - Rich filtering, sorting, aggregation on our collection
4. **Extensible** - Easy to add review queues, pending exercises, etc.
5. **Testable** - Can test state management without Payload job system

**How it works:**
1. Admin creates conversion → new `ConversionJobs` document (status: `draft`)
2. Admin configures and starts → we call `payload.jobs.queue()` and store the returned ID in `payloadJobId`
3. Task handler runs → reads config from `ConversionJobs`, writes progress/results back to `ConversionJobs`
4. UI polls/streams → reads only from `ConversionJobs`
5. `payload-jobs` is just the execution trigger, not the source of truth

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONVERSION SYSTEM v2                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐         │
│  │ Lesson View  │     │ Sidebar Nav  │     │ Direct URL   │         │
│  │ [Convert →]  │     │ Conversions  │     │ /conversions │         │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘         │
│         │                    │                    │                  │
│         └────────────────────┼────────────────────┘                  │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                 /admin/conversions (Dashboard)                  │ │
│  │                                                                 │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │
│  │  │ Queued  │ │ Running │ │ Paused  │ │ Review  │ │Complete │  │ │
│  │  │   (3)   │ │   (1)   │ │   (2)   │ │   (4)   │ │  (47)   │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │ │
│  │                                                                 │ │
│  │  [+ New Conversion]  [Templates]  [Bulk Actions]               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              /admin/conversions/new (Wizard)                    │ │
│  │                                                                 │ │
│  │  Step 1: Source Selection                                       │ │
│  │  Step 2: Configuration                                          │ │
│  │  Step 3: Additional Rounds                                      │ │
│  │  Step 4: Review Mode                                            │ │
│  │  Step 5: Confirmation                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │            /admin/conversions/[jobId] (Job View)                │ │
│  │                                                                 │ │
│  │  - Real-time progress (SSE)                                     │ │
│  │  - Log viewer                                                   │ │
│  │  - Review queue                                                 │ │
│  │  - Exercise preview                                             │ │
│  │  - Actions: Pause, Resume, Cancel, Retry                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Models

### 2.1 ConversionJobs Collection (New)

A dedicated Payload collection for conversion jobs with richer state management.

**File**: `src/server/payload/collections/ConversionJobs.ts`

```typescript
import type { CollectionConfig } from 'payload'

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
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
    },

    // ===== Status & Progress =====
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },           // Configuration in progress
        { label: 'Queued', value: 'queued' },         // Waiting to start
        { label: 'Running', value: 'running' },       // Actively processing
        { label: 'Paused', value: 'paused' },         // Admin paused
        { label: 'Review', value: 'review' },         // Waiting for admin review
        { label: 'Completed', value: 'completed' },   // Successfully finished
        { label: 'Failed', value: 'failed' },         // Error occurred
        { label: 'Cancelled', value: 'cancelled' },   // Admin cancelled
      ],
    },
    {
      name: 'currentStage',
      type: 'select',
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
      ],
      admin: { description: 'Current processing stage' },
    },
    {
      name: 'currentStageMessage',
      type: 'text',
      admin: { description: 'Human-readable stage status' },
    },

    // ===== Progress Tracking =====
    {
      name: 'progress',
      type: 'group',
      fields: [
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
            { name: 'excludePages', type: 'json', defaultValue: [], admin: { description: 'Array of page numbers to skip' } },
          ],
        },
        // Segmentation settings
        {
          name: 'segmentation',
          type: 'group',
          fields: [
            { name: 'pagesPerSegment', type: 'number', defaultValue: 2, min: 1, max: 10 },
            { name: 'customBoundaries', type: 'json', defaultValue: [], admin: { description: 'Custom segment page ranges' } },
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
            { name: 'customInstructions', type: 'textarea', admin: { description: 'Additional extraction guidance' } },
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
        { name: 'name', type: 'text', required: true, admin: { description: 'e.g., "Diagram Analysis"' } },
        { name: 'prompt', type: 'relationship', relationTo: 'prompts', required: true },
        { name: 'targetField', type: 'text', required: true, admin: { description: 'Field name to store result' } },
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
        { name: 'customCondition', type: 'code', admin: { language: 'json', description: 'JSONPath expression' } },
        { name: 'order', type: 'number', required: true, defaultValue: 1 },
        { name: 'isEnabled', type: 'checkbox', defaultValue: true },
        // Snapshot
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
        { name: 'content', type: 'json', admin: { description: 'Extracted exercise content' } },
        { name: 'enrichments', type: 'json', admin: { description: 'Results from additional rounds' } },
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
        { name: 'savedExerciseId', type: 'text', admin: { description: 'ID after persisted to exercises collection' } },
        // Quality scores
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
      name: 'errors',
      type: 'array',
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
    { fields: { status: 1, createdAt: -1 } },
    { fields: { lesson: 1, status: 1 } },
    { fields: { tenant: 1, status: 1 } },
  ],
}
```

### 2.2 ConversionTemplates Collection (New)

Reusable conversion configurations.

**File**: `src/server/payload/collections/ConversionTemplates.ts`

```typescript
import type { CollectionConfig } from 'payload'

export const ConversionTemplates: CollectionConfig = {
  slug: 'conversion-templates',

  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'tenant', 'isDefault', 'updatedAt'],
    group: 'Tools',
  },

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Template name (e.g., "Standard Math Extraction")' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'When to use this template' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: { description: 'Leave empty for global templates' },
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Use as default for new conversions' },
    },

    // ===== Configuration (mirrors ConversionJobs.config) =====
    {
      name: 'segmentation',
      type: 'group',
      fields: [
        { name: 'pagesPerSegment', type: 'number', defaultValue: 2, min: 1, max: 10 },
      ],
    },
    {
      name: 'extraction',
      type: 'group',
      fields: [
        { name: 'mode', type: 'select', defaultValue: 'structured', options: ['structured', 'flexible'] },
        { name: 'exerciseTypes', type: 'select', hasMany: true, defaultValue: ['mcq', 'free_response', 'select'], options: ['mcq', 'free_response', 'select', 'fill_blank', 'matching'] },
        { name: 'customInstructions', type: 'textarea' },
      ],
    },
    {
      name: 'reviewMode',
      type: 'select',
      defaultValue: 'segment',
      options: ['auto', 'segment', 'batch', 'manual'],
    },

    // ===== Prompts =====
    {
      name: 'extractorPrompt',
      type: 'relationship',
      relationTo: 'prompts',
      filterOptions: { usage: { equals: 'extractor' }, status: { equals: 'published' } },
    },
    {
      name: 'verifierPrompt',
      type: 'relationship',
      relationTo: 'prompts',
      filterOptions: { usage: { equals: 'verifier' }, status: { equals: 'published' } },
    },

    // ===== Additional Rounds =====
    {
      name: 'additionalRounds',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'prompt', type: 'relationship', relationTo: 'prompts', required: true },
        { name: 'targetField', type: 'text', required: true },
        { name: 'triggerCondition', type: 'select', defaultValue: 'always', options: ['always', 'has_image', 'has_table', 'has_diagram', 'custom'] },
        { name: 'customCondition', type: 'code', admin: { language: 'json' } },
        { name: 'order', type: 'number', required: true, defaultValue: 1 },
      ],
    },
  ],

  timestamps: true,
}
```

### 2.3 Updated Prompts Collection

Add new usage types for enrichment rounds.

**Modification**: `src/server/payload/collections/Prompts.ts`

```typescript
// Update the usage field options
{
  name: 'usage',
  type: 'select',
  options: [
    { label: 'Chat', value: 'chat' },
    { label: 'PDF Extractor', value: 'extractor' },
    { label: 'PDF Verifier', value: 'verifier' },
    // NEW: Enrichment round prompts
    { label: 'Diagram Analyzer', value: 'round_diagram' },
    { label: 'Table Extractor', value: 'round_table' },
    { label: 'Hint Generator', value: 'round_hints' },
    { label: 'Solution Extractor', value: 'round_solution' },
    { label: 'Accessibility Describer', value: 'round_accessibility' },
    { label: 'Custom Enrichment', value: 'round_custom' },
  ],
  defaultValue: 'chat',
}
```

### 2.4 Updated Exercises Collection

Add enrichments field for additional round results.

**Modification**: `src/server/payload/collections/Exercises/index.ts`

```typescript
// Add to Conversion Metadata collapsible section
{
  name: 'enrichments',
  type: 'json',
  admin: {
    description: 'Results from additional extraction rounds',
    components: {
      Field: '@/ui/admin/ExerciseEnrichmentsViewer#ExerciseEnrichmentsViewer',
    },
  },
},
```

**Enrichments Schema** (`src/server/payload/collections/Exercises/schemas.ts`):

```typescript
import { z } from 'zod'

export const EnrichmentResultSchema = z.object({
  roundId: z.string(),
  roundName: z.string(),
  extractedAt: z.string().datetime(),
  promptHash: z.string(),
  data: z.record(z.unknown()),
})

export const EnrichmentsSchema = z.record(z.string(), EnrichmentResultSchema).optional()

// Example enrichments structure:
// {
//   diagramAnalysis: {
//     roundId: "round_123",
//     roundName: "Diagram Analysis",
//     extractedAt: "2024-01-15T10:30:00Z",
//     promptHash: "abc123",
//     data: {
//       description: "A right triangle with sides labeled a, b, c",
//       elements: ["right angle marker", "side labels", "hypotenuse"],
//       mathematicalConcepts: ["Pythagorean theorem", "trigonometry"]
//     }
//   },
//   hints: {
//     roundId: "round_456",
//     roundName: "Hint Generator",
//     extractedAt: "2024-01-15T10:31:00Z",
//     promptHash: "def456",
//     data: {
//       hints: [
//         "Remember the Pythagorean theorem: a² + b² = c²",
//         "The longest side is always opposite the right angle"
//       ]
//     }
//   }
// }
```

### 2.5 Updated Types

**File**: `src/server/payload/jobs/types.ts`

```typescript
// Add new stages for v2
export type JobStage =
  // Existing stages
  | 'INIT'
  | 'PDF_LOAD'
  | 'PDF_SEGMENT'
  | 'SEGMENT_EXTRACT'
  | 'SEGMENT_VERIFY'
  | 'SEGMENT_PERSIST'
  | 'COMPLETE'
  | 'FAILED'
  | 'CANCELLED'
  // NEW: v2 interactive stages
  | 'PDF_PREVIEW'           // Waiting for admin to review PDF
  | 'CONFIGURATION'         // Waiting for settings confirmation
  | 'SEGMENT_QUEUE'         // Waiting for segment approval
  | 'SEGMENT_REVIEW'        // Waiting for extraction review
  | 'ROUND_PROCESSING'      // Processing additional rounds
  | 'VERIFICATION_REVIEW'   // Waiting for rejection review
  | 'FINAL_APPROVAL'        // Waiting for final approval
  | 'PAUSED'                // Admin paused

// Additional round configuration
export interface ExtractionRound {
  id: string
  name: string
  promptId: string
  targetField: string
  triggerCondition: 'always' | 'has_image' | 'has_table' | 'has_diagram' | 'custom'
  customCondition?: string
  order: number
  isEnabled: boolean
  // Runtime state
  promptSnapshot?: {
    template: string
    hash: string
  }
}

// Extended job input for v2
export interface PdfToExercisesInputV2 extends PdfToExercisesInput {
  // Page range
  pageRange: {
    start: number
    end?: number
    excludePages: number[]
  }
  // Segmentation
  segmentation: {
    pagesPerSegment: number
    customBoundaries?: Array<{ start: number; end: number }>
  }
  // Extraction
  extraction: {
    mode: 'structured' | 'flexible'
    exerciseTypes: string[]
    customInstructions?: string
  }
  // Review mode
  reviewMode: 'auto' | 'segment' | 'batch' | 'manual'
  // Additional rounds
  additionalRounds: ExtractionRound[]
}

// Pending exercise in review queue
export interface PendingExercise {
  id: string
  segmentIndex: number
  orderInSegment: number
  title: string
  content: unknown  // Exercise content schema
  enrichments: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'skipped'
  verificationResult?: {
    passed: boolean
    message: string
    issues?: string[]
  }
  scores: {
    confidence: number
    completeness: number
    complexity: number
    duplicateLikelihood: number
  }
  adminNotes?: string
  savedExerciseId?: string
}

// Extended output for v2
export interface PdfToExercisesOutputV2 extends PdfToExercisesOutputExtended {
  // Review queue
  pendingExercises: PendingExercise[]
  // Round processing state
  roundsCompleted: number
  roundsTotal: number
  currentRoundIndex?: number
  currentRoundName?: string
}
```

---

## 3. Workflow Stages

### 3.1 Stage Definitions

| Stage | Status | Admin Action | Auto-Transition |
|-------|--------|--------------|-----------------|
| `INIT` | draft | None | → PDF_PREVIEW |
| `PDF_PREVIEW` | draft | Confirm pages | → CONFIGURATION |
| `CONFIGURATION` | draft | Set options | → PDF_LOAD (on submit) |
| `PDF_LOAD` | running | None | → PDF_SEGMENT |
| `PDF_SEGMENT` | running | None | → SEGMENT_QUEUE or SEGMENT_EXTRACT |
| `SEGMENT_QUEUE` | review | Approve/Skip segments | → SEGMENT_EXTRACT |
| `SEGMENT_EXTRACT` | running | None | → SEGMENT_REVIEW or ROUND_PROCESSING |
| `SEGMENT_REVIEW` | review | Edit/Approve exercises | → ROUND_PROCESSING or SEGMENT_VERIFY |
| `ROUND_PROCESSING` | running | None | → SEGMENT_VERIFY |
| `SEGMENT_VERIFY` | running | None | → VERIFICATION_REVIEW or SEGMENT_PERSIST |
| `VERIFICATION_REVIEW` | review | Override/Skip | → SEGMENT_PERSIST |
| `SEGMENT_PERSIST` | running | None | → next segment or FINAL_APPROVAL |
| `FINAL_APPROVAL` | review | Final review | → COMPLETE |
| `COMPLETE` | completed | View results | Terminal |
| `FAILED` | failed | Retry/Dismiss | Terminal (can retry) |
| `CANCELLED` | cancelled | None | Terminal |
| `PAUSED` | paused | Resume | → Previous stage |

### 3.2 Stage Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONVERSION WORKFLOW v2                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────┐                                                                    │
│  │ INIT │                                                                    │
│  └──┬───┘                                                                    │
│     │ auto                                                                   │
│     ↓                                                                        │
│  ┌─────────────┐                                                             │
│  │ PDF_PREVIEW │ ◄─────────────────────────────────────────┐                │
│  │  (review)   │  Admin sees PDF thumbnails, page count    │                │
│  └──────┬──────┘                                           │                │
│         │ [Confirm Pages]                                   │                │
│         ↓                                                   │                │
│  ┌───────────────┐                                         │                │
│  │ CONFIGURATION │ ◄────────────────────────────────────┐  │                │
│  │   (review)    │  Admin sets prompts, rounds, options │  │                │
│  └───────┬───────┘                                      │  │                │
│          │ [Start Conversion]                           │  │                │
│          ↓                                              │  │                │
│  ┌──────────┐                                           │  │                │
│  │ PDF_LOAD │                                           │  │                │
│  │ (running)│  Load PDF, validate                       │  │                │
│  └────┬─────┘                                           │  │                │
│       │ auto                                            │  │                │
│       ↓                                                 │  │                │
│  ┌─────────────┐                                        │  │                │
│  │ PDF_SEGMENT │                                        │  │                │
│  │  (running)  │  Split into segments                   │  │                │
│  └──────┬──────┘                                        │  │                │
│         │                                               │  │                │
│         ├─────────────────────┐                         │  │                │
│         │ (if reviewMode      │ (if reviewMode          │  │                │
│         │  = 'manual')        │  != 'manual')           │  │                │
│         ↓                     ↓                         │  │                │
│  ┌───────────────┐    ┌─────────────────┐              │  │                │
│  │ SEGMENT_QUEUE │    │                 │              │  │                │
│  │   (review)    │    │                 │              │  │                │
│  └───────┬───────┘    │                 │              │  │                │
│          │ [Approve]  │                 │              │  │                │
│          ↓            ↓                 │              │  │                │
│         ┌───────────────────┐           │              │  │                │
│         │ SEGMENT_EXTRACT   │◄──────────┘              │  │                │
│  ┌─────►│    (running)      │  LLM extraction          │  │                │
│  │      └─────────┬─────────┘                          │  │                │
│  │                │                                    │  │                │
│  │                ├─────────────────┐                  │  │                │
│  │                │ (if reviewMode  │ (if reviewMode   │  │                │
│  │                │  = 'segment')   │  != 'segment')   │  │                │
│  │                ↓                 ↓                  │  │                │
│  │        ┌────────────────┐  ┌──────────────────┐    │  │                │
│  │        │ SEGMENT_REVIEW │  │                  │    │  │                │
│  │        │    (review)    │  │                  │    │  │                │
│  │        └───────┬────────┘  │                  │    │  │                │
│  │                │ [Approve] │                  │    │  │                │
│  │                ↓           ↓                  │    │  │                │
│  │        ┌────────────────────┐                 │    │  │                │
│  │        │ ROUND_PROCESSING   │◄────────────────┘    │  │                │
│  │        │    (running)       │  Additional rounds   │  │                │
│  │        └─────────┬──────────┘                      │  │                │
│  │                  │ auto                            │  │                │
│  │                  ↓                                 │  │                │
│  │        ┌─────────────────┐                         │  │                │
│  │        │ SEGMENT_VERIFY  │                         │  │                │
│  │        │   (running)     │  LLM verification       │  │                │
│  │        └────────┬────────┘                         │  │                │
│  │                 │                                  │  │                │
│  │                 ├─────────────────┐                │  │                │
│  │                 │ (if failures)   │ (if all pass)  │  │                │
│  │                 ↓                 ↓                │  │                │
│  │        ┌─────────────────────┐   │                 │  │                │
│  │        │ VERIFICATION_REVIEW │   │                 │  │                │
│  │        │      (review)       │   │                 │  │                │
│  │        └──────────┬──────────┘   │                 │  │                │
│  │                   │ [Override]   │                 │  │                │
│  │                   ↓              ↓                 │  │                │
│  │        ┌────────────────────────────┐             │  │                │
│  │        │    SEGMENT_PERSIST         │             │  │                │
│  │        │       (running)            │  Save to DB │  │                │
│  │        └───────────┬────────────────┘             │  │                │
│  │                    │                              │  │                │
│  │                    │ (more segments?)             │  │                │
│  │        ┌───────────┴───────────┐                  │  │                │
│  │        │ YES                   │ NO               │  │                │
│  └────────┘                       ↓                  │  │                │
│                          ┌────────────────┐          │  │                │
│                          │ FINAL_APPROVAL │◄─────────┘  │                │
│                          │    (review)    │ (if batch)  │                │
│                          └───────┬────────┘             │                │
│                                  │ [Finalize]           │                │
│                                  ↓                      │                │
│                          ┌──────────┐                   │                │
│                          │ COMPLETE │                   │                │
│                          └──────────┘                   │                │
│                                                         │                │
│  ══════════════════════════════════════════════════════╪════════════════│
│                     ERROR/CONTROL PATHS                 │                │
│                                                         │                │
│  Any Stage ──► [Cancel] ──► CANCELLED                   │                │
│  Any Stage ──► [Pause]  ──► PAUSED ──► [Resume] ──► Previous Stage      │
│  Any Error ──► FAILED ──► [Retry] ──► INIT ─────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. API Endpoints

### Payload-First Approach

We leverage Payload's built-in REST API for standard CRUD operations on our collections. This gives us:
- Automatic validation against collection schema
- Built-in access control
- Depth population for relationships
- Filtering, sorting, pagination out of the box
- GraphQL support for free

**Custom endpoints** are only needed for actions that can't be expressed as simple updates.

### 4.1 Payload REST API (Built-in)

#### ConversionJobs Collection (`/api/conversion-jobs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conversion-jobs` | List jobs (paginated, filtered) |
| `POST` | `/api/conversion-jobs` | Create new conversion (draft) |
| `GET` | `/api/conversion-jobs/:id` | Get job details |
| `PATCH` | `/api/conversion-jobs/:id` | Update job (config, status, etc.) |
| `DELETE` | `/api/conversion-jobs/:id` | Delete job |

**Query examples:**
```
# List running jobs for a lesson
GET /api/conversion-jobs?where[lesson][equals]=123&where[status][equals]=running

# Get job with populated relationships
GET /api/conversion-jobs/456?depth=2

# Filter by multiple statuses
GET /api/conversion-jobs?where[status][in]=queued,running,review
```

#### ConversionTemplates Collection (`/api/conversion-templates`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conversion-templates` | List templates |
| `POST` | `/api/conversion-templates` | Create template |
| `GET` | `/api/conversion-templates/:id` | Get template |
| `PATCH` | `/api/conversion-templates/:id` | Update template |
| `DELETE` | `/api/conversion-templates/:id` | Delete template |

### 4.2 Custom Endpoints (Actions)

These endpoints handle complex actions that involve business logic beyond simple CRUD.

**Directory:** `src/server/payload/endpoints/conversion-jobs/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/conversion-jobs/:id/start` | Start conversion (queues Payload job) |
| `POST` | `/api/conversion-jobs/:id/pause` | Pause running job |
| `POST` | `/api/conversion-jobs/:id/resume` | Resume paused job |
| `POST` | `/api/conversion-jobs/:id/cancel` | Cancel job |
| `POST` | `/api/conversion-jobs/:id/retry` | Create new job from failed job |
| `POST` | `/api/conversion-jobs/:id/approve-stage` | Approve current review stage |
| `POST` | `/api/conversion-jobs/:id/approve-all` | Bulk approve pending exercises |
| `GET` | `/api/conversion-jobs/:id/stream` | SSE stream (logs, status, progress) |
| `GET` | `/api/conversion-jobs/:id/preview` | Get PDF preview thumbnails |

### 4.3 Collection Endpoints Configuration

Custom endpoints are registered via the collection's `endpoints` config:

```typescript
// src/server/payload/collections/ConversionJobs.ts
export const ConversionJobs: CollectionConfig = {
  slug: 'conversion-jobs',
  // ... fields ...

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
      path: '/:id/stream',
      method: 'get',
      handler: streamHandler,
    },
    {
      path: '/:id/preview',
      method: 'get',
      handler: previewHandler,
    },
  ],
}
```

### 4.4 Endpoint Handlers

**Directory:** `src/server/payload/endpoints/conversion-jobs/`

```
conversion-jobs/
├── start.ts           # Start conversion
├── pause.ts           # Pause job
├── resume.ts          # Resume job
├── cancel.ts          # Cancel job
├── retry.ts           # Retry failed job
├── approve-stage.ts   # Approve review stage
├── approve-all.ts     # Bulk approve exercises
├── stream.ts          # SSE streaming
├── preview.ts         # PDF preview thumbnails
└── index.ts           # Re-exports all handlers
```

### 4.5 Endpoint Specifications

#### `POST /api/conversion-jobs/:id/start`

Start a conversion job. Validates config is complete, snapshots prompts, queues Payload job.

**Request:** (empty body - config should already be set via PATCH)
```json
{}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "conv_abc",
    "status": "queued",
    "currentStage": "PDF_LOAD",
    "payloadJobId": "job_xyz"
  }
}
```

**Workflow:**
1. UI creates job: `POST /api/conversion-jobs` with `lessonId`, `mediaId`
2. UI updates config: `PATCH /api/conversion-jobs/:id` with config, prompts, rounds
3. UI starts job: `POST /api/conversion-jobs/:id/start`

#### `POST /api/conversion-jobs/:id/pause`

Pause a running job. Sets status to `paused`, saves current state.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "conv_abc",
    "status": "paused",
    "currentStage": "SEGMENT_EXTRACT",
    "pausedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### `POST /api/conversion-jobs/:id/resume`

Resume a paused job. Returns to previous stage.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "conv_abc",
    "status": "running",
    "currentStage": "SEGMENT_EXTRACT"
  }
}
```

#### `POST /api/conversion-jobs/:id/cancel`

Cancel a job. Only works for queued, running, paused, or review status.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "conv_abc",
    "status": "cancelled",
    "currentStage": "CANCELLED"
  }
}
```

#### `POST /api/conversion-jobs/:id/retry`

Create a new job from a failed job with the same configuration.

**Response:**
```json
{
  "success": true,
  "originalJobId": "conv_abc",
  "newJob": {
    "id": "conv_def",
    "status": "draft",
    "currentStage": "INIT"
  }
}
```

#### `POST /api/conversion-jobs/:id/approve-stage`

Approve the current review stage and continue processing.

**Request:**
```json
{
  "action": "approve",  // or "skip" for segment stages
  "segmentIndex": 2,    // optional, for segment-specific actions
  "exerciseIndices": [0, 1, 3]  // optional, for selective approval
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "conv_abc",
    "status": "running",
    "currentStage": "ROUND_PROCESSING"
  }
}
```

#### `POST /api/conversion-jobs/:id/approve-all`

Bulk approve all pending exercises.

**Response:**
```json
{
  "success": true,
  "approved": 12,
  "job": {
    "id": "conv_abc",
    "status": "running",
    "currentStage": "SEGMENT_PERSIST"
  }
}
```

#### `POST /api/conversions/[id]/exercises/[idx]/edit`

Edit a pending exercise before approval.

**Request:**
```json
{
  "content": {
    "blocks": [/* updated blocks */]
  },
  "title": "Updated Exercise Title"
}
```

**Response:**
```json
{
  "success": true,
  "exercise": {
    "status": "edited",
    "content": { /* ... */ }
  }
}
```

#### `GET /api/conversions/[id]/stream`

Server-Sent Events stream for real-time updates.

**Events:**
```
event: status
data: {"status":"running","stage":"SEGMENT_EXTRACT","message":"Processing segment 3/8"}

event: progress
data: {"completedSegments":2,"totalSegments":8,"totalExercises":12}

event: log
data: {"timestamp":"...","level":"info","stage":"SEGMENT_EXTRACT","message":"Extracted 4 exercises"}

event: review_required
data: {"stage":"SEGMENT_REVIEW","pendingCount":4,"segmentIndex":2}

event: done
data: {"status":"completed","totalExercises":32}

event: error
data: {"code":"EXTRACTION_FAILED","message":"LLM request failed","stage":"SEGMENT_EXTRACT"}
```

---

## 5. UI Components

### 5.1 Route Structure

```
src/app/(payload)/admin/conversions/
├── page.tsx                    # Dashboard (list view)
├── new/
│   └── page.tsx               # New conversion wizard
├── [id]/
│   ├── page.tsx               # Job detail view
│   └── review/
│       └── page.tsx           # Full-screen review mode
└── templates/
    ├── page.tsx               # Template list
    └── [id]/
        └── page.tsx           # Template editor
```

### 5.2 Component Hierarchy

```
ConversionDashboard/
├── ConversionHeader          # Title, filters, actions
├── ConversionStats           # Status counts (kanban-style)
├── ConversionTable           # Job list with sorting/filtering
│   └── ConversionRow         # Single job row
├── ConversionFilters         # Status, date, lesson filters
└── Pagination

ConversionWizard/
├── WizardProgress            # Step indicator
├── Step1_SourceSelection     # Lesson + PDF selection
├── Step2_PdfPreview          # Thumbnails, page range
├── Step3_Configuration       # Prompts, segment size, types
├── Step4_AdditionalRounds    # Round configuration
├── Step5_ReviewMode          # Auto/segment/batch/manual
└── Step6_Confirmation        # Summary before start

ConversionJobView/
├── JobHeader                 # Status, title, actions
├── JobProgress               # Visual progress bar + stages
├── JobTabs
│   ├── OverviewTab           # Summary, stats, timeline
│   ├── SegmentsTab           # Segment status list
│   ├── ExercisesTab          # Pending exercises review
│   ├── LogsTab               # Searchable log viewer
│   └── ConfigTab             # Job configuration (readonly)
├── PendingReviewPanel        # Slide-over for exercise review
└── ActionButtons             # Pause, Resume, Cancel, etc.

ExerciseReviewPanel/
├── ExerciseHeader            # Title, scores, status
├── ContentPreview            # Rich preview of exercise
├── EnrichmentResults         # Additional round results
├── VerificationStatus        # Pass/fail with reasons
├── AdminNotes                # Editable notes field
├── EditForm                  # Inline content editor
└── ActionButtons             # Approve, Reject, Edit, Skip
```

### 5.3 Key Components

#### ConversionDashboard

```typescript
// src/ui/admin/ConversionDashboard/index.tsx
'use client'

export function ConversionDashboard() {
  const [filters, setFilters] = useState<Filters>({ status: 'all' })
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useConversionJobs(filters, page)

  return (
    <div className="conversion-dashboard">
      <ConversionHeader onNewConversion={() => router.push('/admin/conversions/new')} />
      <ConversionStats jobs={data?.docs} />
      <ConversionFilters filters={filters} onChange={setFilters} />
      <ConversionTable
        jobs={data?.docs}
        isLoading={isLoading}
        onRowClick={(job) => router.push(`/admin/conversions/${job.id}`)}
      />
      <Pagination
        page={page}
        totalPages={data?.totalPages}
        onChange={setPage}
      />
    </div>
  )
}
```

#### ConversionWizard

```typescript
// src/ui/admin/ConversionWizard/index.tsx
'use client'

const STEPS = [
  'source',
  'preview',
  'config',
  'rounds',
  'review-mode',
  'confirm'
] as const

export function ConversionWizard({ lessonId, mediaId }: Props) {
  const [step, setStep] = useState<typeof STEPS[number]>('source')
  const [config, setConfig] = useState<ConversionConfig>(getDefaultConfig())

  const handleComplete = async () => {
    const job = await createConversion({
      lessonId: config.lessonId,
      mediaId: config.mediaId,
      config: config.settings,
      prompts: config.prompts,
      additionalRounds: config.rounds,
    })
    await startConversion(job.id)
    router.push(`/admin/conversions/${job.id}`)
  }

  return (
    <div className="conversion-wizard">
      <WizardProgress steps={STEPS} current={step} />

      {step === 'source' && (
        <SourceSelection
          value={config}
          onChange={setConfig}
          onNext={() => setStep('preview')}
        />
      )}

      {step === 'preview' && (
        <PdfPreview
          mediaId={config.mediaId}
          pageRange={config.settings.pageRange}
          onPageRangeChange={(range) => setConfig(c => ({
            ...c,
            settings: { ...c.settings, pageRange: range }
          }))}
          onBack={() => setStep('source')}
          onNext={() => setStep('config')}
        />
      )}

      {/* ... other steps */}

      {step === 'confirm' && (
        <Confirmation
          config={config}
          onBack={() => setStep('review-mode')}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}
```

#### ExerciseReviewPanel

```typescript
// src/ui/admin/ConversionJobView/ExerciseReviewPanel.tsx
'use client'

export function ExerciseReviewPanel({
  exercise,
  jobId,
  onAction
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(exercise.content)

  const handleApprove = async () => {
    await approveExercise(jobId, exercise.id)
    onAction('approved')
  }

  const handleReject = async (reason: string) => {
    await rejectExercise(jobId, exercise.id, reason)
    onAction('rejected')
  }

  const handleSaveEdit = async () => {
    await editExercise(jobId, exercise.id, editedContent)
    setIsEditing(false)
    onAction('edited')
  }

  return (
    <div className="exercise-review-panel">
      <ExerciseHeader
        title={exercise.title}
        status={exercise.status}
        scores={exercise.scores}
      />

      <ScoreIndicators scores={exercise.scores} />

      {exercise.verificationResult && (
        <VerificationStatus result={exercise.verificationResult} />
      )}

      {isEditing ? (
        <ExerciseContentEditor
          value={editedContent}
          onChange={setEditedContent}
          onSave={handleSaveEdit}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <ExerciseContentPreview content={exercise.content} />
      )}

      {Object.keys(exercise.enrichments || {}).length > 0 && (
        <EnrichmentResults enrichments={exercise.enrichments} />
      )}

      <AdminNotesField
        value={exercise.adminNotes}
        onChange={(notes) => updateExerciseNotes(jobId, exercise.id, notes)}
      />

      <div className="action-buttons">
        <Button onClick={handleApprove} variant="success">
          Approve
        </Button>
        <Button onClick={() => setIsEditing(true)} variant="secondary">
          Edit
        </Button>
        <Button onClick={() => showRejectDialog(handleReject)} variant="danger">
          Reject
        </Button>
        {exercise.verificationResult?.passed === false && (
          <Button onClick={() => overrideVerification(jobId, exercise.id)}>
            Override Verification
          </Button>
        )}
      </div>
    </div>
  )
}
```

---

## 6. Multi-Round Extraction

### 6.1 Round Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROUND PROCESSING                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  For each exercise in segment:                                   │
│                                                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Exercise: "Solve for x in the triangle below"           │  │
│    │ Content: { blocks: [...], hasImage: true }              │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ↓                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Round 1: Diagram Analysis                               │  │
│    │   Trigger: has_image ✓                                  │  │
│    │   Prompt: "Analyze the geometric diagram..."            │  │
│    │   ────────────────────────────────────────────────────  │  │
│    │   Result:                                               │  │
│    │   {                                                     │  │
│    │     "description": "Right triangle with labeled sides", │  │
│    │     "elements": ["angle A", "side a=5", "side b=?"],   │  │
│    │     "concepts": ["Pythagorean theorem"]                 │  │
│    │   }                                                     │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ↓                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Round 2: Hint Generator                                 │  │
│    │   Trigger: always ✓                                     │  │
│    │   Prompt: "Generate progressive hints..."               │  │
│    │   ────────────────────────────────────────────────────  │  │
│    │   Result:                                               │  │
│    │   {                                                     │  │
│    │     "hints": [                                          │  │
│    │       "What theorem relates the sides of a right △?",  │  │
│    │       "a² + b² = c²",                                   │  │
│    │       "Substitute: 5² + b² = ?"                         │  │
│    │     ]                                                   │  │
│    │   }                                                     │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ↓                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Round 3: Solution Extractor                             │  │
│    │   Trigger: custom (hasAnswerKey=true) ✗ SKIP            │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ↓                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Final Exercise:                                         │  │
│    │ {                                                       │  │
│    │   content: { blocks: [...] },                          │  │
│    │   enrichments: {                                        │  │
│    │     diagramAnalysis: { ... },                          │  │
│    │     hints: { ... }                                      │  │
│    │   }                                                     │  │
│    │ }                                                       │  │
│    └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Trigger Conditions

| Condition | Description | Detection Logic |
|-----------|-------------|-----------------|
| `always` | Run for every exercise | Always true |
| `has_image` | Exercise contains image block | Check `blocks.some(b => b.type === 'image')` |
| `has_table` | Exercise contains table | Check content for table patterns |
| `has_diagram` | Exercise has geometric/chart diagram | Image + caption contains diagram keywords |
| `custom` | JSONPath expression | Evaluate against exercise content |

### 6.3 Round Implementation

```typescript
// src/server/payload/jobs/round-processor.ts

export async function processRounds(
  exercise: ExtractedExercise,
  rounds: ExtractionRound[],
  pdfSegment: Buffer,
  jobLogger: JobLogger,
): Promise<Record<string, EnrichmentResult>> {
  const enrichments: Record<string, EnrichmentResult> = {}

  // Sort rounds by order
  const sortedRounds = [...rounds].sort((a, b) => a.order - b.order)

  for (const round of sortedRounds) {
    if (!round.isEnabled) continue

    // Check trigger condition
    const shouldRun = evaluateTrigger(round.triggerCondition, round.customCondition, exercise)

    if (!shouldRun) {
      await jobLogger.info('ROUND_PROCESSING', `Skipping round "${round.name}" - trigger not met`)
      continue
    }

    await jobLogger.info('ROUND_PROCESSING', `Running round "${round.name}"`, {
      targetField: round.targetField
    })

    try {
      const result = await executeRound(round, exercise, pdfSegment)

      enrichments[round.targetField] = {
        roundId: round.id,
        roundName: round.name,
        extractedAt: new Date().toISOString(),
        promptHash: round.promptSnapshot?.hash || '',
        data: result,
      }

      await jobLogger.info('ROUND_PROCESSING', `Round "${round.name}" completed`, {
        resultKeys: Object.keys(result),
      })
    } catch (error) {
      await jobLogger.warn('ROUND_PROCESSING', `Round "${round.name}" failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Continue with other rounds - don't fail the whole exercise
    }
  }

  return enrichments
}

function evaluateTrigger(
  condition: string,
  customCondition: string | undefined,
  exercise: ExtractedExercise,
): boolean {
  switch (condition) {
    case 'always':
      return true
    case 'has_image':
      return exercise.content.blocks.some(b => b.type === 'image')
    case 'has_table':
      return detectTable(exercise.content)
    case 'has_diagram':
      return detectDiagram(exercise.content)
    case 'custom':
      return evaluateJSONPath(customCondition!, exercise)
    default:
      return false
  }
}
```

---

## 7. Migration Strategy

### 7.1 Phases

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Add new collections (ConversionJobs, ConversionTemplates) | 1 week |
| 2 | Create new API endpoints | 1 week |
| 3 | Build UI components | 2 weeks |
| 4 | Update job handler for v2 | 1 week |
| 5 | Migration tool for existing jobs | 1 week |
| 6 | Testing & refinement | 1 week |

### 7.2 Backward Compatibility

- **Existing jobs**: Continue using `payload-jobs` collection
- **New jobs**: Use `conversion-jobs` collection with reference to `payload-jobs`
- **Lesson page**: Keep minimal conversion panel linking to new dashboard
- **API**: v1 endpoints remain functional, v2 endpoints added alongside

### 7.3 Feature Flags

```typescript
// src/server/payload/jobs/constants.ts
export const CONVERSION_V2_ENABLED = process.env.CONVERSION_V2_ENABLED === 'true'
```

### 7.4 Data Migration

```typescript
// scripts/migrate-conversion-jobs.ts
async function migrateExistingJobs() {
  const oldJobs = await db.collection('payload-jobs').find({
    taskSlug: 'pdf_to_exercises'
  }).toArray()

  for (const oldJob of oldJobs) {
    const newJob = {
      title: `Migration: ${oldJob.input.ctx.lessonId}`,
      payloadJobId: oldJob._id.toString(),
      lesson: oldJob.input.ctx.lessonId,
      sourceMedia: oldJob.input.ctx.sourceDocId,
      tenant: oldJob.input.ctx.tenantId,
      status: mapStatus(oldJob),
      currentStage: oldJob.output?.currentStage || 'COMPLETE',
      progress: extractProgress(oldJob.output),
      config: extractConfig(oldJob.input),
      prompts: extractPrompts(oldJob.input),
      logs: oldJob.output?.logs || [],
      createdAt: oldJob.createdAt,
      completedAt: oldJob.completedAt,
    }

    await payload.create({
      collection: 'conversion-jobs',
      data: newJob,
    })
  }
}
```

---

## Appendix

### A. Error Codes

| Code | Description | Recovery |
|------|-------------|----------|
| `PDF_LOAD_FAILED` | Could not load PDF | Retry or re-upload |
| `PDF_TOO_LARGE` | PDF exceeds size limit | Split or compress |
| `EXTRACTION_FAILED` | LLM extraction error | Retry with different prompt |
| `VERIFICATION_FAILED` | All exercises failed verification | Review manually |
| `ROUND_FAILED` | Enrichment round error | Skip round or retry |
| `PERSISTENCE_FAILED` | Database save error | Retry |
| `TIMEOUT` | Operation timed out | Retry with smaller segment |

### B. Quality Score Calculations

```typescript
// Confidence: LLM's self-reported confidence (0-1)
// Extracted from LLM response metadata

// Completeness: Required fields present
function calculateCompleteness(exercise: Exercise): number {
  const required = ['title', 'content', 'content.blocks']
  const present = required.filter(field => get(exercise, field))
  return present.length / required.length
}

// Complexity: Estimated difficulty
function calculateComplexity(exercise: Exercise): number {
  // Factors: block count, math expressions, images, nested questions
  let score = 0
  score += Math.min(exercise.content.blocks.length / 10, 0.3)
  score += countLatexBlocks(exercise) * 0.1
  score += hasImage(exercise) ? 0.2 : 0
  score += countQuestionBlocks(exercise) * 0.1
  return Math.min(score, 1)
}

// Duplicate likelihood: Similarity to existing exercises
async function calculateDuplicateLikelihood(
  exercise: Exercise,
  lessonId: string
): Promise<number> {
  const existing = await getExercisesByLesson(lessonId)
  const similarities = existing.map(e => computeSimilarity(exercise, e))
  return Math.max(...similarities, 0)
}
```

### C. SSE Event Schema

```typescript
interface SSEEvent {
  event: 'status' | 'progress' | 'log' | 'review_required' | 'done' | 'error'
  data: StatusEvent | ProgressEvent | LogEvent | ReviewEvent | DoneEvent | ErrorEvent
}

interface StatusEvent {
  status: ConversionStatus
  stage: JobStage
  message: string
}

interface ProgressEvent {
  completedSegments: number
  totalSegments: number
  totalExercises: number
  approvedExercises: number
  currentRound?: string
}

interface LogEvent {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  stage: string
  message: string
  details?: Record<string, unknown>
}

interface ReviewEvent {
  stage: 'SEGMENT_REVIEW' | 'VERIFICATION_REVIEW' | 'FINAL_APPROVAL'
  pendingCount: number
  segmentIndex?: number
}

interface DoneEvent {
  status: 'completed' | 'failed' | 'cancelled'
  totalExercises?: number
  error?: string
}

interface ErrorEvent {
  code: string
  message: string
  stage: string
  recoverable: boolean
}
```
