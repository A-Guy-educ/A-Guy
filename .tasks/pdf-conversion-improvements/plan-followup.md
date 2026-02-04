# PDF Conversion v2 - Follow-up Plan

## Overview

This plan addresses gaps discovered between the original [plan.md](./plan.md) and the actual implementation. The implementation used different directory structures and some components are missing or incomplete.

---

## Implementation Status Summary

### ✅ Completed (Different Locations)

| Planned Location | Actual Location |
|------------------|-----------------|
| `src/app/(payload)/admin/conversions/` | `src/app/(payload)/admin/conversion-jobs/` |
| `src/ui/admin/ConversionDashboard/` | `src/ui/admin/conversion-jobs/` |
| `src/ui/admin/ConversionWizard/` | Not implemented (wizard flow missing) |
| `src/ui/admin/ConversionJobView/` | `src/ui/admin/conversion-jobs/components/` |

### Implemented Files

**Admin Pages:**
- `src/app/(payload)/admin/conversion-jobs/page.tsx` (94 lines) - Dashboard
- `src/app/(payload)/admin/conversion-jobs/[id]/page.tsx` (338 lines) - Job detail

**UI Components:**
- `src/ui/admin/conversion-jobs/components/ConversionTable.tsx` (208 lines)
- `src/ui/admin/conversion-jobs/components/JobProgress.tsx` (189 lines)
- `src/ui/admin/conversion-jobs/components/JobLogs.tsx` (173 lines)
- `src/ui/admin/conversion-jobs/components/Pagination.tsx` (135 lines)
- `src/ui/admin/conversion-jobs/components/ConversionStats.tsx` (81 lines)
- `src/ui/admin/conversion-jobs/components/ConversionFilters.tsx` (65 lines)

**Hooks:**
- `src/ui/admin/conversion-jobs/hooks/useConversionJob.ts` (103 lines)
- `src/ui/admin/conversion-jobs/hooks/useConversionJobs.ts` (101 lines)
- `src/ui/admin/conversion-jobs/hooks/useConversionJobActions.ts` (98 lines)

**Backend:**
- `src/server/payload/collections/ConversionJobs.ts` - Collection defined
- `src/server/payload/collections/ConversionTemplates.ts` - Collection defined
- `src/server/payload/endpoints/conversion-jobs/*.ts` - 12 endpoint handlers
- `src/server/payload/jobs/round-processor.ts` (339 lines) - Multi-round processing
- `src/server/payload/services/conversion-service.ts` (64 lines) - Basic service
- `scripts/migrate-conversion-jobs.ts` (182 lines) - Migration script

**Navigation:**
- `src/ui/admin/ConversionNavLink/` - Sidebar link component

---

## Gap Analysis

### 1. Missing UI Components

#### 1.1 Wizard Flow (Not Implemented)
The original plan specified a multi-step wizard for creating conversions:
- `SourceSelection.tsx` - Lesson + PDF selection
- `PdfPreview.tsx` - Thumbnails, page range selector
- `ConfigurationStep.tsx` - Prompts, segment size, types
- `AdditionalRoundsStep.tsx` - Round configuration
- `ReviewModeStep.tsx` - Auto/segment/batch/manual
- `ConfirmationStep.tsx` - Summary before start

**Current State:** Jobs are created directly without wizard flow.

#### 1.2 Review Components (Partial)
Missing from `ConversionJobView`:
- `ExerciseReviewPanel.tsx` - Slide-over for exercise review
- `ContentPreview.tsx` - Rich preview of exercise
- `EnrichmentResults.tsx` - Additional round results
- `VerificationStatus.tsx` - Pass/fail with reasons
- `AdminNotes.tsx` - Editable notes field
- `ScoreIndicators.tsx` - Quality score badges
- `EditForm.tsx` - Inline content editor

#### 1.3 Missing Routes
- `new/page.tsx` - New conversion wizard entry
- `[id]/review/page.tsx` - Full-screen review mode
- `templates/page.tsx` - Template list
- `templates/[id]/page.tsx` - Template editor

### 2. Missing Backend Services

#### 2.1 Review Service
**File:** `src/server/payload/services/conversion-review-service.ts`

Not implemented. Should contain:
- `approveStage(jobId)` - Approve current review stage
- `approveSegment(jobId, segmentIndex)` - Approve segment
- `skipSegment(jobId, segmentIndex)` - Skip segment
- `getPendingExercises(jobId)` - Get review queue
- `approveExercise(jobId, exerciseIndex)` - Approve exercise
- `rejectExercise(jobId, exerciseIndex, reason)` - Reject exercise
- `editExercise(jobId, exerciseIndex, content)` - Edit exercise
- `overrideVerification(jobId, exerciseIndex)` - Override failure
- `approveAll(jobId)` - Bulk approve
- `finalize(jobId)` - Final approval and persist

#### 2.2 State Machine
**File:** `src/server/payload/jobs/conversion-state-machine.ts`

Not implemented. Should contain:
- State transition definitions
- Review gate handling
- Pause/resume logic
- Error recovery

### 3. Task Handler Updates

**File:** `src/server/payload/jobs/pdf-to-exercises-task.ts`

Needs updates for v2:
- Support v2 input format (PdfToExercisesInputV2)
- Add pause/resume capability
- Add review gate support
- Integrate round processor
- Support pending exercises queue

### 4. Missing Tests

All test files specified in original plan:
- `tests/unit/server/collections/ConversionJobs.spec.ts`
- `tests/unit/server/collections/ConversionTemplates.spec.ts`
- `tests/unit/server/services/conversion-service.spec.ts`
- `tests/unit/server/services/conversion-review-service.spec.ts`
- `tests/unit/server/jobs/round-processor.spec.ts`
- `tests/int/conversion-jobs-endpoints.int.spec.ts`
- `tests/int/conversion-jobs-stream.int.spec.ts`
- `tests/int/conversion-task-v2.int.spec.ts`
- `tests/int/conversion-state-machine.int.spec.ts`
- `tests/e2e/conversion-dashboard.e2e.spec.ts`
- `tests/e2e/conversion-wizard.e2e.spec.ts`
- `tests/e2e/conversion-review.e2e.spec.ts`

---

## Implementation Phases

### Phase A: Complete Review System
**Priority: High**

#### A.1 Review Service
**File:** `src/server/payload/services/conversion-review-service.ts`

```typescript
// Service methods to implement
export const ConversionReviewService = {
  approveStage,
  approveSegment,
  skipSegment,
  getPendingExercises,
  approveExercise,
  rejectExercise,
  editExercise,
  overrideVerification,
  approveAll,
  finalize,
}
```

#### A.2 Exercise Review Panel
**Directory:** `src/ui/admin/conversion-jobs/components/`

- [ ] `ExerciseReviewPanel.tsx` - Slide-over panel
- [ ] `ExercisePreview.tsx` - Content preview
- [ ] `EnrichmentViewer.tsx` - Round results display
- [ ] `VerificationBadge.tsx` - Pass/fail indicator
- [ ] `ExerciseEditor.tsx` - Inline editing

#### A.3 Review Page
**File:** `src/app/(payload)/admin/conversion-jobs/[id]/review/page.tsx`

Full-screen review mode for batch exercise approval.

---

### Phase B: Wizard Flow
**Priority: Medium**

#### B.1 Wizard Components
**Directory:** `src/ui/admin/conversion-jobs/wizard/`

- [ ] `index.tsx` - Wizard container with step management
- [ ] `StepIndicator.tsx` - Progress indicator
- [ ] `SourceStep.tsx` - Lesson + PDF selection
- [ ] `PreviewStep.tsx` - PDF thumbnails, page range
- [ ] `ConfigStep.tsx` - Prompts, segmentation
- [ ] `RoundsStep.tsx` - Additional rounds configuration
- [ ] `ReviewModeStep.tsx` - Review mode selection
- [ ] `ConfirmStep.tsx` - Summary and start

#### B.2 New Conversion Page
**File:** `src/app/(payload)/admin/conversion-jobs/new/page.tsx`

Entry point for wizard flow.

---

### Phase C: State Machine & Task Handler
**Priority: High**

#### C.1 State Machine
**File:** `src/server/payload/jobs/conversion-state-machine.ts`

```typescript
// State transitions
const transitions = {
  'draft': ['queued'],
  'queued': ['running', 'cancelled'],
  'running': ['paused', 'review', 'completed', 'failed', 'cancelled'],
  'paused': ['running', 'cancelled'],
  'review': ['running', 'cancelled'],
  'completed': [],
  'failed': ['queued'], // retry
  'cancelled': [],
}
```

#### C.2 Task Handler v2 Support
**File:** `src/server/payload/jobs/pdf-to-exercises-task.ts`

- [ ] Detect v2 input format
- [ ] Implement pause check at stage boundaries
- [ ] Implement review gate pausing
- [ ] Call round processor after extraction
- [ ] Update ConversionJobs collection instead of just output

---

### Phase D: Templates UI
**Priority: Low**

#### D.1 Template Pages
**Directory:** `src/app/(payload)/admin/conversion-jobs/templates/`

- [ ] `page.tsx` - Template list
- [ ] `[id]/page.tsx` - Template editor
- [ ] `new/page.tsx` - New template

#### D.2 Template Components
**Directory:** `src/ui/admin/conversion-jobs/templates/`

- [ ] `TemplateList.tsx`
- [ ] `TemplateForm.tsx`
- [ ] `TemplateCard.tsx`

---

### Phase E: Tests
**Priority: Medium**

#### E.1 Unit Tests
- [ ] `tests/unit/server/jobs/round-processor.spec.ts`
- [ ] `tests/unit/server/services/conversion-review-service.spec.ts`

#### E.2 Integration Tests
- [ ] `tests/int/conversion-jobs-endpoints.int.spec.ts`
- [ ] `tests/int/conversion-state-machine.int.spec.ts`

#### E.3 E2E Tests
- [ ] `tests/e2e/conversion-dashboard.e2e.spec.ts`
- [ ] `tests/e2e/conversion-review.e2e.spec.ts`

---

## File Summary

### New Files to Create

| File | Purpose | Priority |
|------|---------|----------|
| `src/server/payload/services/conversion-review-service.ts` | Review actions | High |
| `src/server/payload/jobs/conversion-state-machine.ts` | State transitions | High |
| `src/ui/admin/conversion-jobs/components/ExerciseReviewPanel.tsx` | Review UI | High |
| `src/ui/admin/conversion-jobs/components/ExercisePreview.tsx` | Content preview | High |
| `src/ui/admin/conversion-jobs/components/EnrichmentViewer.tsx` | Round results | Medium |
| `src/ui/admin/conversion-jobs/wizard/*.tsx` | Wizard components | Medium |
| `src/app/(payload)/admin/conversion-jobs/new/page.tsx` | Wizard entry | Medium |
| `src/app/(payload)/admin/conversion-jobs/[id]/review/page.tsx` | Review page | High |
| `src/app/(payload)/admin/conversion-jobs/templates/*.tsx` | Template pages | Low |

### Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/server/payload/jobs/pdf-to-exercises-task.ts` | v2 support | High |
| `src/server/payload/services/conversion-service.ts` | Add missing methods | Medium |

---

## Acceptance Criteria

### Phase A (Review System)
- [ ] Review service implements all review actions
- [ ] Exercise review panel opens from job detail
- [ ] Exercises can be approved/rejected/edited
- [ ] Bulk approve works
- [ ] Finalize persists exercises to database

### Phase B (Wizard)
- [ ] Wizard creates conversion with full configuration
- [ ] PDF preview shows page thumbnails
- [ ] Page range selection works
- [ ] Additional rounds can be configured
- [ ] Review mode can be selected

### Phase C (State Machine)
- [ ] Jobs transition through correct states
- [ ] Pause/resume works at stage boundaries
- [ ] Review gates pause job correctly
- [ ] Round processor integrates with task handler

### Phase D (Templates)
- [ ] Templates can be created and saved
- [ ] Templates can be applied to new conversions
- [ ] Per-tenant templates work

### Phase E (Tests)
- [ ] Round processor has unit tests
- [ ] Endpoints have integration tests
- [ ] Dashboard has E2E tests

---

## Notes

1. **Directory Naming:** The implementation uses `conversion-jobs` (kebab-case) instead of `ConversionJobs` (PascalCase) for directories. Continue this pattern.

2. **Hooks Pattern:** The implementation uses custom hooks (`useConversionJob`, etc.) which is good. Continue this pattern for new features.

3. **Component Structure:** Components are in `components/` subdirectory with hooks in `hooks/`. Continue this pattern.

4. **Original Plan:** Keep [plan.md](./plan.md) as reference. This follow-up plan focuses on gaps only.
