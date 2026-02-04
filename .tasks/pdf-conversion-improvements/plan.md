# PDF Conversion System v2 - Implementation Plan

## Overview

Transform the PDF-to-exercises conversion system from a fire-and-forget process into an interactive, multi-step workflow with dedicated admin UI and enhanced observability.

**Key Changes:**
1. **Dedicated Conversion Page** - Standalone `/admin/conversions` (like Media library)
2. **Multi-Round Extraction** - Additional AI processing rounds per exercise (diagrams, hints, etc.)
3. **Admin Control Points** - Review gates at each stage
4. **Real-Time Observability** - SSE streaming, structured logging

**Full Specification:** [SPEC.md](./SPEC.md)

---

## Architecture Comparison

| Aspect | Current (v1) | Proposed (v2) |
|--------|--------------|---------------|
| **Entry Point** | Embedded in Lesson edit | Standalone `/admin/conversions` |
| **Job State** | Fire-and-forget | Pausable, resumable with review gates |
| **Extraction** | Single extractor prompt | Multi-round with enrichment |
| **Admin Control** | Select prompts only | Full configuration wizard |
| **Observability** | 10s polling | Real-time SSE streaming |
| **Review** | Post-completion only | Per-segment, per-exercise review |

### Key Architecture Decision

**Problem:** Payload's `payload-jobs` is inflexible - limited schema, hard to customize.

**Solution:** Two-layer architecture:
- **State Layer** (`ConversionJobs` collection) - We own this. All state, config, progress, review queues.
- **Execution Layer** (`payload-jobs`) - Just triggers task handler. We don't query it directly.

The task handler reads from and writes to `ConversionJobs`. The `payloadJobId` field is just an optional reference for debugging. See [SPEC.md](./SPEC.md) for full details.

---

## Workflow Stages

```
PDF → [Preview] → [Configure] → [Segment Queue] → [Extract] → [Review] → [Rounds] → [Verify] → [Approve] → Save
          ↑           ↑              ↑              ↑           ↑          ↑          ↑           ↑
       Admin       Admin          Admin          Auto       Admin      Auto       Admin       Admin
       Gate        Gate           Gate                      Gate                  Gate        Gate
```

### Stage Definitions

| Stage | Type | Description |
|-------|------|-------------|
| `PDF_PREVIEW` | Review | Admin sees thumbnails, selects page range |
| `CONFIGURATION` | Review | Admin sets prompts, rounds, options |
| `SEGMENT_QUEUE` | Review | Admin approves/skips segments (manual mode) |
| `SEGMENT_EXTRACT` | Auto | LLM extracts exercises |
| `SEGMENT_REVIEW` | Review | Admin edits/approves extracted exercises |
| `ROUND_PROCESSING` | Auto | Additional AI rounds (diagram, hints, etc.) |
| `SEGMENT_VERIFY` | Auto | LLM verifies exercises |
| `VERIFICATION_REVIEW` | Review | Admin handles verification failures |
| `FINAL_APPROVAL` | Review | Admin final review before save |
| `COMPLETE` | Terminal | All exercises saved |

---

## Implementation Phases

### Phase 1: Data Models & Collections
**Duration:** 1 week

#### 1.1 Create ConversionJobs Collection
**File:** `src/server/payload/collections/ConversionJobs.ts`

- [ ] Define collection with fields:
  - Identification (title, payloadJobId)
  - Source references (lesson, sourceMedia, tenant)
  - Status & progress tracking
  - Configuration (pageRange, segmentation, extraction, reviewMode)
  - Prompts with snapshots
  - Additional rounds array
  - Segments array with status
  - Pending exercises review queue
  - Logs array
  - Timing fields
- [ ] Add indexes for common queries
- [ ] Register in payload.config.ts

#### 1.2 Create ConversionTemplates Collection
**File:** `src/server/payload/collections/ConversionTemplates.ts`

- [ ] Define template fields matching ConversionJobs.config
- [ ] Add tenant scoping for per-org templates
- [ ] Add isDefault flag

#### 1.3 Update Prompts Collection
**File:** `src/server/payload/collections/Prompts.ts`

- [ ] Add new usage options:
  - `round_diagram` - Diagram Analyzer
  - `round_table` - Table Extractor
  - `round_hints` - Hint Generator
  - `round_solution` - Solution Extractor
  - `round_accessibility` - Accessibility Describer
  - `round_custom` - Custom Enrichment

#### 1.4 Update Exercises Collection
**File:** `src/server/payload/collections/Exercises/index.ts`

- [ ] Add `enrichments` JSON field for round results
- [ ] Create EnrichmentsSchema in schemas.ts
- [ ] Create ExerciseEnrichmentsViewer component

#### 1.5 Update Types
**File:** `src/server/payload/jobs/types.ts`

- [ ] Add new JobStage values
- [ ] Add ExtractionRound interface
- [ ] Add PendingExercise interface
- [ ] Add PdfToExercisesInputV2 interface
- [ ] Add PdfToExercisesOutputV2 interface

**Tests:**
- [ ] `tests/unit/server/collections/ConversionJobs.spec.ts`
- [ ] `tests/unit/server/collections/ConversionTemplates.spec.ts`

---

### Phase 2: Backend Services
**Duration:** 1 week

#### 2.1 Conversion Service
**File:** `src/server/payload/services/conversion-service.ts`

- [ ] `createConversion(lessonId, mediaId, templateId?)` - Create draft job
- [ ] `startConversion(jobId, config)` - Start processing
- [ ] `pauseConversion(jobId)` - Pause running job
- [ ] `resumeConversion(jobId)` - Resume paused job
- [ ] `cancelConversion(jobId)` - Cancel job
- [ ] `retryConversion(jobId)` - Create new job from failed

#### 2.2 Review Service
**File:** `src/server/payload/services/conversion-review-service.ts`

- [ ] `approveStage(jobId)` - Approve current review stage
- [ ] `approveSegment(jobId, segmentIndex)` - Approve segment
- [ ] `skipSegment(jobId, segmentIndex)` - Skip segment
- [ ] `getPendingExercises(jobId)` - Get review queue
- [ ] `approveExercise(jobId, exerciseIndex)` - Approve exercise
- [ ] `rejectExercise(jobId, exerciseIndex, reason)` - Reject exercise
- [ ] `editExercise(jobId, exerciseIndex, content)` - Edit exercise
- [ ] `overrideVerification(jobId, exerciseIndex)` - Override failure
- [ ] `approveAll(jobId)` - Bulk approve
- [ ] `finalize(jobId)` - Final approval and persist

#### 2.3 Round Processor
**File:** `src/server/payload/jobs/round-processor.ts`

- [ ] `processRounds(exercise, rounds, pdfSegment, logger)` - Run all rounds
- [ ] `evaluateTrigger(condition, customCondition, exercise)` - Check if round should run
- [ ] `executeRound(round, exercise, pdfSegment)` - Execute single round
- [ ] Trigger condition evaluators:
  - `always` - Always true
  - `has_image` - Check for image blocks
  - `has_table` - Check for table patterns
  - `has_diagram` - Check for diagram keywords
  - `custom` - JSONPath evaluation

**Tests:**
- [ ] `tests/unit/server/services/conversion-service.spec.ts`
- [ ] `tests/unit/server/services/conversion-review-service.spec.ts`
- [ ] `tests/unit/server/jobs/round-processor.spec.ts`

---

### Phase 3: API Endpoints (Payload-First)
**Duration:** 1 week

**Approach:** Use Payload's built-in REST API for CRUD. Only create custom endpoints for actions.

#### 3.1 Payload REST API (Built-in - No Code Needed)
CRUD operations are automatically provided by Payload:

- `GET /api/conversion-jobs` - List jobs (with filtering, pagination)
- `POST /api/conversion-jobs` - Create job
- `GET /api/conversion-jobs/:id` - Get job
- `PATCH /api/conversion-jobs/:id` - Update job
- `DELETE /api/conversion-jobs/:id` - Delete job

Same for `conversion-templates` collection.

#### 3.2 Custom Action Endpoints
**Directory:** `src/server/payload/endpoints/conversion-jobs/`

These are registered via the collection's `endpoints` config:

- [ ] `start.ts` - `POST /:id/start` - Start conversion (queue Payload job)
- [ ] `pause.ts` - `POST /:id/pause` - Pause running job
- [ ] `resume.ts` - `POST /:id/resume` - Resume paused job
- [ ] `cancel.ts` - `POST /:id/cancel` - Cancel job
- [ ] `retry.ts` - `POST /:id/retry` - Create new job from failed
- [ ] `approve-stage.ts` - `POST /:id/approve-stage` - Approve review stage
- [ ] `approve-all.ts` - `POST /:id/approve-all` - Bulk approve exercises
- [ ] `stream.ts` - `GET /:id/stream` - SSE streaming
- [ ] `preview.ts` - `GET /:id/preview` - PDF preview thumbnails
- [ ] `index.ts` - Re-export all handlers

#### 3.3 Register Endpoints in Collection
**File:** `src/server/payload/collections/ConversionJobs.ts`

- [ ] Add `endpoints` array to collection config
- [ ] Import and register all handlers

**Tests:**
- [ ] `tests/int/conversion-jobs-endpoints.int.spec.ts`
- [ ] `tests/int/conversion-jobs-stream.int.spec.ts`

---

### Phase 4: UI Components
**Duration:** 2 weeks

#### 4.1 Route Structure
**Directory:** `src/app/(payload)/admin/conversions/`

- [ ] `page.tsx` - Dashboard (list view)
- [ ] `new/page.tsx` - New conversion wizard
- [ ] `[id]/page.tsx` - Job detail view
- [ ] `[id]/review/page.tsx` - Full-screen review mode
- [ ] `templates/page.tsx` - Template list
- [ ] `templates/[id]/page.tsx` - Template editor

#### 4.2 Dashboard Components
**Directory:** `src/ui/admin/ConversionDashboard/`

- [ ] `index.tsx` - Main dashboard
- [ ] `ConversionHeader.tsx` - Title, filters, actions
- [ ] `ConversionStats.tsx` - Status counts (kanban-style)
- [ ] `ConversionTable.tsx` - Job list with sorting/filtering
- [ ] `ConversionRow.tsx` - Single job row
- [ ] `ConversionFilters.tsx` - Status, date, lesson filters
- [ ] `styles.css` - Dashboard styles

#### 4.3 Wizard Components
**Directory:** `src/ui/admin/ConversionWizard/`

- [ ] `index.tsx` - Wizard container
- [ ] `WizardProgress.tsx` - Step indicator
- [ ] `SourceSelection.tsx` - Lesson + PDF selection
- [ ] `PdfPreview.tsx` - Thumbnails, page range selector
- [ ] `ConfigurationStep.tsx` - Prompts, segment size, types
- [ ] `AdditionalRoundsStep.tsx` - Round configuration
- [ ] `ReviewModeStep.tsx` - Auto/segment/batch/manual
- [ ] `ConfirmationStep.tsx` - Summary before start
- [ ] `styles.css` - Wizard styles

#### 4.4 Job View Components
**Directory:** `src/ui/admin/ConversionJobView/`

- [ ] `index.tsx` - Main job view
- [ ] `JobHeader.tsx` - Status, title, actions
- [ ] `JobProgress.tsx` - Visual progress bar + stages
- [ ] `JobTabs.tsx` - Tab navigation
- [ ] `OverviewTab.tsx` - Summary, stats, timeline
- [ ] `SegmentsTab.tsx` - Segment status list
- [ ] `ExercisesTab.tsx` - Pending exercises review
- [ ] `LogsTab.tsx` - Searchable log viewer
- [ ] `ConfigTab.tsx` - Job configuration (readonly)
- [ ] `ActionButtons.tsx` - Pause, Resume, Cancel, etc.
- [ ] `styles.css` - Job view styles

#### 4.5 Review Components
**Directory:** `src/ui/admin/ConversionJobView/`

- [ ] `ExerciseReviewPanel.tsx` - Slide-over for exercise review
- [ ] `ExerciseHeader.tsx` - Title, scores, status
- [ ] `ContentPreview.tsx` - Rich preview of exercise
- [ ] `EnrichmentResults.tsx` - Additional round results
- [ ] `VerificationStatus.tsx` - Pass/fail with reasons
- [ ] `AdminNotes.tsx` - Editable notes field
- [ ] `ScoreIndicators.tsx` - Quality score badges
- [ ] `EditForm.tsx` - Inline content editor

#### 4.6 Navigation
**File:** `src/ui/admin/ConversionNavLink/index.tsx`

- [ ] Sidebar link to `/admin/conversions`
- [ ] Badge showing active job count
- [ ] Add to admin.components.beforeNavLinks

#### 4.7 Update Lesson Page
**File:** `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx`

- [ ] Replace with compact `LessonConversionSummary`
- [ ] Show active job count badge
- [ ] "Convert" button navigates to `/admin/conversions/new?lessonId=X&mediaId=Y`
- [ ] "View Jobs" link to dashboard filtered by lesson

**Tests:**
- [ ] `tests/e2e/conversion-dashboard.e2e.spec.ts`
- [ ] `tests/e2e/conversion-wizard.e2e.spec.ts`
- [ ] `tests/e2e/conversion-review.e2e.spec.ts`

---

### Phase 5: Job Handler Update
**Duration:** 1 week

#### 5.1 Update Task Handler
**File:** `src/server/payload/jobs/pdf-to-exercises-task.ts`

- [ ] Support v2 input format (PdfToExercisesInputV2)
- [ ] Add pause/resume capability
- [ ] Add review gate support
- [ ] Integrate round processor
- [ ] Update progress tracking for new stages
- [ ] Support pending exercises queue

#### 5.2 State Machine Implementation
**File:** `src/server/payload/jobs/conversion-state-machine.ts`

- [ ] Define state transitions
- [ ] Handle review gates
- [ ] Handle pause/resume
- [ ] Handle errors and recovery

#### 5.3 SSE Stream Handler
**File:** `src/server/payload/jobs/conversion-stream.ts`

- [ ] Poll MongoDB for updates
- [ ] Emit status events
- [ ] Emit progress events
- [ ] Emit log events
- [ ] Emit review_required events
- [ ] Handle connection lifecycle

**Tests:**
- [ ] `tests/int/conversion-task-v2.int.spec.ts`
- [ ] `tests/int/conversion-state-machine.int.spec.ts`

---

### Phase 6: Migration & Cleanup
**Duration:** 1 week

#### 6.1 Migration Script
**File:** `scripts/migrate-conversion-jobs.ts`

- [ ] Migrate existing jobs from `payload-jobs` to `conversion-jobs`
- [ ] Preserve history and logs
- [ ] Handle partial migrations

#### 6.2 Feature Flag
**File:** `src/server/payload/jobs/constants.ts`

- [ ] Add `CONVERSION_V2_ENABLED` flag
- [ ] Support gradual rollout

#### 6.3 Backward Compatibility
- [ ] Keep v1 endpoints functional
- [ ] Keep v1 task handler for in-flight jobs
- [ ] Document deprecation path

#### 6.4 Documentation
- [ ] Update AGENTS.md with new workflow
- [ ] Create admin user guide
- [ ] Update API documentation

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/server/payload/collections/ConversionJobs.ts` | New collection (with custom endpoints) |
| `src/server/payload/collections/ConversionTemplates.ts` | Template collection |
| `src/server/payload/endpoints/conversion-jobs/*.ts` | Custom action endpoint handlers |
| `src/server/payload/services/conversion-service.ts` | Job management |
| `src/server/payload/services/conversion-review-service.ts` | Review actions |
| `src/server/payload/jobs/round-processor.ts` | Multi-round processing |
| `src/server/payload/jobs/conversion-state-machine.ts` | State transitions |
| `src/app/(payload)/admin/conversions/**` | New admin pages |
| `src/ui/admin/ConversionDashboard/**` | Dashboard components |
| `src/ui/admin/ConversionWizard/**` | Wizard components |
| `src/ui/admin/ConversionJobView/**` | Job view components |
| `.tasks/pdf-conversion-improvements/SPEC.md` | Technical specification |

### Modified Files

| File | Changes |
|------|---------|
| `src/server/payload/collections/Prompts.ts` | Add round usage types |
| `src/server/payload/collections/Exercises/index.ts` | Add enrichments field |
| `src/server/payload/collections/Exercises/schemas.ts` | Add EnrichmentsSchema |
| `src/server/payload/jobs/types.ts` | Add v2 types |
| `src/server/payload/jobs/pdf-to-exercises-task.ts` | Support v2 workflow |
| `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` | Simplify to summary |
| `src/payload.config.ts` | Register new collections, nav |

---

## Test Coverage Matrix

| Feature | Unit | Integration | E2E |
|---------|------|-------------|-----|
| ConversionJobs collection | ✓ | - | - |
| ConversionTemplates collection | ✓ | - | - |
| Conversion service | ✓ | ✓ | - |
| Review service | ✓ | ✓ | - |
| Round processor | ✓ | - | - |
| Custom endpoints (start, pause, etc.) | - | ✓ | - |
| SSE streaming | - | ✓ | - |
| Dashboard UI | - | - | ✓ |
| Wizard UI | - | - | ✓ |
| Review UI | - | - | ✓ |
| State machine | - | ✓ | - |

---

## Acceptance Criteria

### Phase 1 (Data Models)
- [ ] ConversionJobs collection created and registered
- [ ] ConversionTemplates collection created and registered
- [ ] Prompts usage field has new round types
- [ ] Exercises enrichments field added
- [ ] Types updated for v2

### Phase 2 (Services)
- [ ] Conversion service handles full job lifecycle
- [ ] Review service handles all review actions
- [ ] Round processor executes enrichment rounds

### Phase 3 (API)
- [ ] All CRUD endpoints work
- [ ] Job control endpoints work
- [ ] Review action endpoints work
- [ ] SSE streaming works
- [ ] Template endpoints work

### Phase 4 (UI)
- [ ] Dashboard shows job list with filtering
- [ ] Wizard creates jobs with full configuration
- [ ] Job view shows real-time progress
- [ ] Review panel allows exercise editing
- [ ] Navigation links work

### Phase 5 (Handler)
- [ ] v2 jobs process through all stages
- [ ] Pause/resume works
- [ ] Review gates pause at correct points
- [ ] Additional rounds execute

### Phase 6 (Migration)
- [ ] Existing jobs migrated
- [ ] Feature flag controls v2 access
- [ ] v1 remains functional
- [ ] Documentation complete

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing conversions | Feature flag, backward compatibility |
| Complex state management | State machine with clear transitions |
| SSE reliability | Fallback to polling, reconnection logic |
| Performance with large PDFs | Segment-based processing, pagination |
| UI complexity | Step-by-step wizard, progressive disclosure |

---

## Non-Goals

- No WebSocket implementation (SSE is simpler for unidirectional streaming)
- No external job queue (continue using Payload's built-in system)
- No job scheduling UI (jobs are triggered manually)
- No job dependencies/chaining
- No notification system (toast messages are client-side only)
- No real-time collaboration (locking only, no co-editing)
