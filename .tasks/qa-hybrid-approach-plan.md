# QA Hybrid Approach Implementation Plan

## Status
**In Progress** — Phase 1 Complete

## Phase Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Scenario System Gaps | ✅ Complete | Normalized actions, selectors, fixtures |
| Phase 2: Scenario Expansion | 🔄 Pending | Expand to 45-55 scenarios |
| Phase 3: Migration | 🔄 Pending | Migrate student E2E tests |
| Phase 4: CI/CD Enhancement | 🔄 Pending | Parallel execution, reporting |
| Phase 5: Tooling & DX | 🔄 Pending | QA agent, CLI, dashboard |

## Overview

This plan outlines a hybrid approach combining **scenario-driven QA** (JSON-based, AI-agent writable) with **existing E2E tests** (TypeScript, human-maintained). The goal is to:

1. Expand scenario-driven QA to cover student-facing user journeys
2. Keep existing E2E tests for infrastructure, admin, and external service testing
3. Migrate relevant student-facing E2E tests to the scenario system
4. Achieve full journey coverage without losing existing quality signals

---

## Current State Assessment

### Scenario-Driven QA (tests/qa/student/)
| Metric | Current | Target |
|--------|---------|--------|
| Scenarios | 16 | 45-55 |
| Journeys Covered | 5/9 | 9/9 |
| Actions | 19 normalized (+17 aliases) | 30-35 |
| Selector Constants | ✅ Implemented | - |
| Fixture Library | ✅ 8 fixtures | - |
| CI Integration | qa-core only | Full tiered |

**Current Scenario Breakdown:**
- **core**: 7 (auth, navigation, lesson flow, MCQ, T/F, free response)
- **feature**: 6 (onboarding, tabs, hints, chat, PDF)
- **edge**: 3 (404, empty answer, access gate)

**Completed Gaps:**
- ✅ Action vocabulary normalized (27 → 19)
- ✅ Selector constants implemented (selector resilience)
- ✅ Fixture library expanded (8 fixtures)
- ✅ Conversation precondition supported

**Remaining Gaps:**
- No mobile/viewport testing actions
- No parallel execution
- No user story layer (only journeys)

### Existing E2E Tests (tests/e2e/)
| Category | Files | Keep? |
|----------|-------|--------|
| Infrastructure | version-footer, pdf-xframe | ✅ Keep |
| Admin Flows | admin-*.spec.ts | ✅ Keep |
| External Services | chat-history, memory-system | ✅ Keep |
| Admin Bug Fixes | v2-*.spec.ts | ✅ Keep |
| Student Flows | verification/*, course-selection | 🔄 Migrate |
| Skipped Tests | exercise-page (most) | 🔄 Migrate |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TEST EXECUTION LAYER                     │
├─────────────────────────────────────────────────────────────┤
│  Playwright Projects:                                       │
│  ├── e2e           → Existing E2E tests                    │
│  ├── qa-core       → Core scenarios (PR gate)               │
│  ├── qa-full       → Core + Feature (merge gate)           │
│  └── qa-nightly    → Full suite + Edge (scheduled)          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TEST DEFINITION LAYER                     │
├──────────────────────────┬──────────────────────────────────┤
│  Scenario-Driven QA       │  Existing E2E Tests               │
│  (tests/qa/student/)     │  (tests/e2e/)                    │
│                          │                                   │
│  ├── scenarios/*.json    │  ├── *spec.ts (admin)            │
│  ├── actions/*.ts        │  ├── *spec.ts (infra)            │
│  ├── journeys/index.ts   │  ├── *spec.ts (external)         │
│  └── runner/*.ts         │  └── helpers/*.ts                 │
│                          │                                   │
│  Student journeys ONLY    │  Admin, infra, external services  │
│  AI-agent writable       │  Human-maintained                 │
│  Declarative (JSON)      │  Imperative (TypeScript)          │
└──────────────────────────┴──────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Scenario System Gaps (2-3 weeks)

**Goal:** Fill critical gaps before migration

#### 1.1 New Actions (5 actions, 1 week)

| Action | Input | Purpose | Priority |
|--------|-------|---------|----------|
| `openExercise` | `{ exerciseRef: string }` | Direct exercise URL navigation | HIGH |
| `expectStorageValue` | `{ key: string, value?: string }` | localStorage assertions | HIGH |
| `setStorage` | `{ key: string, value: string }` | Set localStorage state | HIGH |
| `waitForElement` | `{ selector: string, timeout?: number }` | Explicit waits | MEDIUM |
| `resizeViewport` | `{ width: number, height: number }` | Mobile responsive testing | MEDIUM |

#### 1.2 Selector Resilience (1 week)

**Problem:** Current selectors use CSS classes that break on refactoring.

**Solution:**
```
tests/qa/student/shared/selectors.ts
├── MCQ_OPTION = '[data-option-id="%s"]'
├── QUESTION_CONTAINER = '[data-question-index="%d"]'
└── ...
```

**Steps:**
1. Audit all action handlers for class-based selectors
2. Create selector constants file
3. Add `data-testid` attributes to key components (coordinate with frontend)
4. Update handlers to use selector constants with fallback

#### 1.3 Fixture Library Expansion (1 week)

| Fixture | Purpose | File |
|---------|---------|------|
| `mcq-simple.json` | Basic MCQ exercise | ✅ Existing |
| `true-false-simple.json` | T/F exercise | ✅ Existing |
| `free-response-simple.json` | Free response | ✅ Existing |
| `matching-simple.json` | Matching pairs | ✅ Existing |
| `mcq-with-hint.json` | MCQ with hint content | NEW |
| `multi-exercise-sequence.json` | 3+ exercises in sequence | NEW |
| `table-exercise.json` | Table input exercise | NEW |
| `pdf-block.json` | PDF content block | NEW |

#### 1.4 Additional Precondition Entities (3 days)

| Entity | Purpose | Priority |
|--------|---------|----------|
| `exercise` | Already exists, verify completeness | HIGH |
| `question` (nested) | Support multi-question exercises | MEDIUM |
| `conversation` | Chat scenarios | MEDIUM |

#### 1.5 Action Vocabulary Normalization (MANDATORY)

**Before expanding the scenario system, normalize the action vocabulary.**

**Current Issues:**
- 27 actions (too many, overlapping)
- `goto` duplicates other navigation actions
- `openHome`, `openCourses`, `openCourse`, `openLesson`, `openAskPage` all do URL navigation
- `nextExercise`, `previousExercise` could be one action with direction
- `requestHint`, `requestSolution` could be one action with level
- `expectPdfVisible`, `expectPdfDownloadButtonVisible`, `expectPdfNotVisible` should be parameterized
- Inconsistent naming: `expect*` vs `request*` vs `open*`

**Normalized Vocabulary (18 actions + 3 PDF):**

| # | Action | Input | Category |
|---|--------|-------|----------|
| 1 | `login` | `{ userRef }` | Session |
| 2 | `logout` | `{}` | Session |
| 3 | `startAsGuest` | `{}` | Session |
| 4 | `navigate` | `{ type: 'home'\|'courses'\|'course'\|'lesson'\|'ask'\|'url', ... }` | Navigation |
| 5 | `clickTab` | `{ tab: 'study'\|'practice'\|'ask'\|'test'\|'learn'\|'exams' }` | Navigation |
| 6 | `navigateBack` | `{}` | Navigation |
| 7 | `startLesson` | `{}` | Lesson |
| 8 | `navigateExercise` | `{ direction: 'next'\|'prev' }` | Lesson |
| 9 | `completeLesson` | `{}` | Lesson |
| 10 | `answer` | `{ questionIndex, type, value }` | Exercise |
| 11 | `checkAnswer` | `{ questionIndex }` | Exercise |
| 12 | `requestHelp` | `{ level: 'hint'\|'solution', questionIndex? }` | Exercise |
| 13 | `sendMessage` | `{ text }` | Chat |
| 14 | `waitForMessage` | `{ contains?, timeout? }` | Chat |
| 15 | `see` | `{ text, timeout? }` | Assertion |
| 16 | `dontSee` | `{ text }` | Assertion |
| 17 | `beAt` | `{ pattern }` | Assertion |
| 18 | `seeFeedback` | `{ questionIndex, correct }` | Assertion |
| 19 | `seePdf` | `{ state: 'visible'\|'hidden'\|'blocked', timeout? }` | Assertion |

**Test Utilities (not DSL actions):**
- `setStorage` - Set localStorage
- `getStorage` - Read localStorage  
- `waitForElement` - Explicit wait
- `resizeViewport` - Mobile testing

**Actions to REMOVE (9):**
- `goto` → use `navigate`
- `openHome` → use `navigate`
- `openCourses` → use `navigate`
- `openCourse` → use `navigate`
- `openLesson` → use `navigate`
- `openAskPage` → use `navigate`
- `nextExercise` → use `navigateExercise`
- `previousExercise` → use `navigateExercise`
- `requestHint` → use `requestHelp`
- `requestSolution` → use `requestHelp`
- `expectVisible` → use `see`
- `expectNotVisible` → use `dontSee`
- `expectUrl` → use `beAt`
- `expectFeedback` → use `seeFeedback`
- `expectChatResponse` → use `waitForMessage`
- `sendChatMessage` → use `sendMessage`
- `expectPdfVisible` → use `seePdf`
- `expectPdfDownloadButtonVisible` → use `seePdf`
- `expectPdfNotVisible` → use `seePdf`

**Rules for Adding New Actions:**
1. Semantic over imperative - describe user intent, not UI operation
2. Atomic intent - one action = one user goal
3. Universal semantics - work across locales and page types
4. No overlap - extend existing before creating new
5. DSL vs Utility separation - registry vs utils/
6. Approval required - proposal + migration plan + docs update

---

### Phase 2: Scenario Expansion (3-4 weeks)

**Goal:** Achieve 45-55 scenarios covering all 9 student journeys

#### 2.1 Core Scenarios (25 scenarios, 1 week)

Target: 7-10 core scenarios

| Journey | Scenario ID | Description |
|---------|------------|-------------|
| student-auth | `auth-student-login` | ✅ Existing |
| student-auth | `auth-student-logout` | Login → logout → verify | NEW |
| student-auth | `auth-guest-upgrade` | Guest → sign up → authenticated | NEW |
| student-navigates-content | `navigate-course-catalog` | ✅ Existing |
| student-navigates-content | `navigate-course-to-lesson` | ✅ Existing |
| student-navigates-content | `navigate-lesson-direct` | Direct URL to lesson | NEW |
| student-studies-lesson | `lesson-pager-start-to-complete` | ✅ Existing |
| student-studies-lesson | `lesson-pager-with-back` | Forward + backward navigation | NEW |
| student-solves-exercises | `solve-mcq-correct` | ✅ Existing |
| student-solves-exercises | `solve-mcq-incorrect` | Wrong answer → feedback | NEW |
| student-solves-exercises | `solve-true-false-correct` | ✅ Existing |
| student-solves-exercises | `solve-true-false-incorrect` | Wrong T/F → feedback | NEW |
| student-solves-exercises | `solve-free-response` | ✅ Existing |
| student-solves-exercises | `solve-matching-correct` | Matching pairs correct | NEW |
| student-solves-exercises | `solve-matching-incorrect` | Matching pairs incorrect | NEW |
| student-solves-exercises | `solve-table-input` | Table cell input | NEW |
| student-solves-exercises | `submit-empty-mcq` | ✅ Existing (edge) |
| student-solves-exercises | `check-answer-without-selection` | No option selected | NEW |

#### 2.2 Feature Scenarios (30 scenarios, 1.5 weeks)

Target: 15-20 feature scenarios

| Journey | Scenario ID | Description |
|---------|------------|-------------|
| student-onboarding | `onboarding-greeting-flow` | ✅ Existing |
| student-onboarding | `onboarding-mood-selection` | Select mood on /start | NEW |
| student-onboarding | `onboarding-course-selection` | Select course → /study | NEW |
| student-onboarding | `onboarding-skip-course` | Continue without selection | NEW |
| student-navigates-content | `course-tab-navigation` | ✅ Existing |
| student-navigates-content | `course-tab-learn` | Learn tab content | NEW |
| student-navigates-content | `course-tab-practice` | Practice tab content | NEW |
| student-navigates-content | `course-tab-ask` | Ask AI tab | NEW |
| student-navigates-content | `course-tab-exams` | Exams tab | NEW |
| student-studies-lesson | `help-system-hint` | ✅ Existing |
| student-studies-lesson | `help-system-solution-unlock` | ✅ Existing |
| student-studies-lesson | `help-system-guiding-question` | Hint → guiding → solution | NEW |
| student-studies-lesson | `lesson-progress-indicator` | Progress bar updates | NEW |
| student-chats-with-ai | `chat-send-message-in-lesson` | ✅ Existing |
| student-chats-with-ai | `chat-send-message-standalone` | /ask page | NEW |
| student-chats-with-ai | `chat-streaming-response` | AI typing indicator | NEW |
| student-chats-with-ai | `chat-empty-message` | Send empty → error | NEW |
| student-manages-account | `account-view-profile` | View account page | NEW |
| student-manages-account | `account-edit-name` | Change display name | NEW |
| student-manages-account | `account-change-teacher` | Switch teacher persona | NEW |
| student-plans-study | `study-plan-create` | Create 7-day plan | NEW |
| student-plans-study | `study-plan-view` | View existing plan | NEW |
| student-plans-study | `study-plan-edit` | Modify plan dates | NEW |
| student-plans-study | `study-plan-delete` | Remove study plan | NEW |

#### 2.3 Edge Scenarios (20 scenarios, 1 week)

Target: 10-15 edge scenarios

| Scenario ID | Description |
|-------------|-------------|
| `access-gate-mandatory` | ✅ Existing |
| `access-gate-gated` | Gated content with login prompt | NEW |
| `access-gate-free` | Free content accessible | NEW |
| `exercise-404` | ✅ Existing |
| `lesson-404` | Non-existent lesson URL | NEW |
| `course-404` | Non-existent course | NEW |
| `network-error-lesson` | Simulate offline during lesson | NEW |
| `session-expired` | Token expires mid-session | NEW |
| `chat-rate-limit` | Too many messages | NEW |
| `study-plan-no-exam-date` | Create plan without exam | NEW |
| `study-plan-past-exam-date` | Exam date in past | NEW |

---

### Phase 3: Migration (2-3 weeks)

**Goal:** Migrate student-facing E2E tests to scenario system

#### 3.1 Migration Mapping

| Source File | Target Scenarios | Effort |
|-------------|------------------|--------|
| `verification/exercises.e2e.spec.ts` | 5 new + 3 existing scenarios | 6h |
| `verification/auth-onboarding.e2e.spec.ts` | 2 scenarios (expand existing) | 3h |
| `course-selection.e2e.spec.ts` | 3 scenarios (expand existing) | 4h |
| `verification/lesson-content.e2e.spec.ts` | 2 scenarios (expand existing) | 3h |
| `exercise-page.e2e.spec.ts` (2 working tests) | 2 new scenarios | 3h |

**Total Migration: ~19h**

#### 3.2 Keep As-E2E (No Migration)

```
tests/e2e/
├── version-footer.e2e.spec.ts          # Infrastructure check
├── pdf-embed-xframe.e2e.spec.ts        # X-Frame-Options security
├── admin-editing.e2e.spec.ts            # Admin flow
├── admin-settings.e2e.spec.ts          # Admin flow
├── admin-content.e2e.spec.ts           # Admin flow
├── lesson-chat-history.e2e.spec.ts      # Real AI (needs OPENAI_API_KEY)
├── memory-system.e2e.spec.ts            # Memory pipeline (needs real API)
├── v2-error-display.e2e.spec.ts        # Admin bug fix
├── v2-conversion-panel.e2e.spec.ts     # Admin bug fix
├── v2-canvas-fix.e2e.spec.ts           # Admin bug fix
├── catalog-navigation.e2e.spec.ts       # Admin UI navigation
└── student-support.e2e.spec.ts         # Support UI
```

---

### Phase 4: CI/CD Enhancement (1 week)

#### 4.1 Full Tiered Execution

```yaml
# .github/workflows/ci.yml

jobs:
  qa-scenarios:
    strategy:
      matrix:
        project: [qa-core, qa-full, qa-nightly]
    
    steps:
      - name: Run QA ${{ matrix.project }}
        if: ${{ matrix.project == 'qa-core' }} || 
            github.ref == 'refs/heads/main' ||
            contains(github.event.schedule, 'nightly')
        run: npx playwright test --project=${{ matrix.project }}
```

#### 4.2 Parallel Execution

```typescript
// runner/executor.ts
export async function runScenariosParallel(
  scenarios: Scenario[],
  concurrency: number = 4
): Promise<ScenarioResult[]> {
  // Chunk scenarios into groups
  // Execute each chunk in parallel
  // Merge results
}
```

#### 4.3 Enhanced Reporting

```typescript
// runner/reporter.ts
export interface ScenarioReport {
  total: number
  passed: number
  failed: number
  duration: number
  results: Array<{
    scenarioId: string
    status: 'passed' | 'failed'
    duration: number
    failedStep?: { index: number; action: string; error: string }
    screenshot?: string  // Base64 on failure
  }>
}
```

---

### Phase 5: Tooling & DX (Ongoing)

#### 5.1 QA Agent Integration

Create a QA agent skill that:
1. Reads journey definitions
2. Generates scenario JSON from journey + action vocabulary
3. Validates against schema
4. Commits for human review

#### 5.2 Scenario Generator CLI

```bash
# Generate scenario from template
pnpm qa:generate --journey=student-auth --type=core

# Interactive mode
pnpm qa:generate --interactive
```

#### 5.3 Coverage Dashboard

Track scenario coverage by journey:
- Dashboard showing % of journeys covered
- Missing scenarios identified
- Scenario → Code coverage mapping

---

## Detailed Task Breakdown

### Phase 1 Tasks

| # | Task | Files | Hours |
|---|------|-------|-------|
| 1.1.1 | Add `openExercise` action | `actions/openExercise.ts` | 2h |
| 1.1.2 | Add `expectStorageValue` action | `actions/expectStorageValue.ts` | 2h |
| 1.1.3 | Add `setStorage` action | `actions/setStorage.ts` | 2h |
| 1.1.4 | Add `waitForElement` action | `actions/waitForElement.ts` | 2h |
| 1.1.5 | Add `resizeViewport` action | `actions/resizeViewport.ts` | 2h |
| 1.2.1 | Create `shared/selectors.ts` | `shared/selectors.ts` | 3h |
| 1.2.2 | Audit handlers for class selectors | `actions/*.ts` | 4h |
| 1.2.3 | Update handlers to use constants | `actions/*.ts` | 3h |
| 1.3.1 | Add `mcq-with-hint.json` fixture | `fixtures/mcq-with-hint.json` | 1h |
| 1.3.2 | Add `multi-exercise-sequence.json` | `fixtures/multi-exercise-sequence.json` | 2h |
| 1.3.3 | Add `table-exercise.json` | `fixtures/table-exercise.json` | 1h |
| 1.3.4 | Add `pdf-block.json` | `fixtures/pdf-block.json` | 1h |
| 1.4.1 | Verify `conversation` seeding | `runner/seed.ts` | 1h |

**Phase 1 Total: ~22 hours**

### Phase 2 Tasks

| # | Task | Hours |
|---|------|-------|
| 2.1 | Core scenarios (25) | 16h |
| 2.2 | Feature scenarios (30) | 24h |
| 2.3 | Edge scenarios (20) | 16h |

**Phase 2 Total: ~56 hours**

### Phase 3 Tasks

| # | Task | Source | Hours |
|---|------|--------|-------|
| 3.1 | Migrate exercises tests | verification/exercises.e2e.spec.ts | 6h |
| 3.2 | Migrate auth tests | verification/auth-onboarding.e2e.spec.ts | 3h |
| 3.3 | Migrate course selection | course-selection.e2e.spec.ts | 4h |
| 3.4 | Migrate lesson content | verification/lesson-content.e2e.spec.ts | 3h |
| 3.5 | Migrate exercise-page | exercise-page.e2e.spec.ts (2 tests) | 3h |

**Phase 3 Total: ~19 hours**

### Phase 4 Tasks

| # | Task | Hours |
|---|------|-------|
| 4.1 | Update CI workflow | 4h |
| 4.2 | Implement parallel execution | 6h |
| 4.3 | Add JSON report output | 3h |
| 4.4 | Add screenshot on failure | 3h |

**Phase 4 Total: ~16 hours**

### Phase 5 Tasks (Ongoing)

| # | Task | Hours |
|---|------|-------|
| 5.1 | QA agent skill | 8h |
| 5.2 | Scenario generator CLI | 12h |
| 5.3 | Coverage dashboard | 16h |

**Phase 5 Total: ~36 hours (initial)**

---

## Total Effort (Revised)

| Phase | Hours |
|-------|-------|
| Phase 1: Scenario System Gaps | 22h |
| Phase 2: Scenario Expansion | 40h |
| Phase 3: Migration | 19h |
| Phase 4: CI/CD Enhancement | 16h |
| Phase 5: Tooling & DX (optional) | 20h |
| User Story Definition | 8h |
| **Total** | **~125h (~5 weeks at 25h/week)** |

> Note: 80-100 scenarios was overambitious. **Realistic target: 45-55 scenarios** covering all 9 journeys with 15-20 user stories providing the structure.

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Student journey coverage | 5/9 (55%) | 9/9 (100%) |
| Core scenarios | 7 | 10 |
| Feature scenarios | 6 | 20-25 |
| Edge scenarios | 3 | 10-15 |
| Total scenarios | 16 | 45-55 |
| Action vocabulary | 24 | 30-35 |
| CI tiered execution | qa-core only | qa-core + qa-full + qa-nightly |
| Migration completion | 0% | 100% (student flows) |
| User stories defined | 0 | 15-20 |

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Selector fragility breaks tests | HIGH | Add `data-testid` + selector constants |
| Scenarios become stale | MEDIUM | QA agent generates updates |
| Migration effort underestimated | MEDIUM | Buffer 20% in estimates |
| Parallel execution complexity | LOW | Implement after baseline established |
| Dual maintenance during transition | LOW | Short transition period (< 4 weeks) |

---

## Dependencies

1. **Frontend team** must add `data-testid` attributes to:
   - Exercise question containers
   - MCQ option buttons
   - True/False buttons
   - Free response inputs
   - Matching pair items

2. **Backend team** (no dependencies)

3. **DevOps** must configure:
   - `qa-nightly` scheduled job in CI
   - Playwright secrets for `e2e` project

---

## File Structure (Post-Implementation)

```
tests/
├── qa/
│   └── student/
│       ├── actions/
│       │   ├── types.ts
│       │   ├── registry.ts
│       │   ├── login.ts
│       │   ├── logout.ts
│       │   ├── openExercise.ts       # NEW
│       │   ├── expectStorageValue.ts # NEW
│       │   ├── setStorage.ts        # NEW
│       │   ├── waitForElement.ts     # NEW
│       │   ├── resizeViewport.ts     # NEW
│       │   └── ... (existing)
│       ├── fixtures/
│       │   ├── exercise-content/
│       │   │   ├── mcq-simple.json
│       │   │   ├── mcq-with-hint.json   # NEW
│       │   │   ├── multi-exercise.json   # NEW
│       │   │   └── table-exercise.json   # NEW
│       │   └── ...
│       ├── journeys/
│       │   └── index.ts
│       ├── user-stories/              # NEW
│       │   ├── auth.json
│       │   ├── navigation.json
│       │   ├── exercises.json
│       │   ├── chat.json
│       │   ├── study-plan.json
│       │   └── account.json
│       ├── runner/
│       │   ├── scenario-runner.ts
│       │   ├── executor.ts           # NEW (parallel)
│       │   ├── reporter.ts           # NEW (enhanced)
│       │   └── ...
│       ├── scenarios/
│       │   ├── core/                 # 10 scenarios
│       │   ├── feature/               # 20-25 scenarios
│       │   └── edge/                 # 10-15 scenarios
│       ├── schema/
│       │   └── scenario.schema.ts
│       └── shared/
│           ├── locales.ts
│           └── selectors.ts          # NEW
├── e2e/
│   ├── verification/                 # KEPT (not migrated)
│   ├── admin-*.e2e.spec.ts          # KEPT
│   ├── version-footer.e2e.spec.ts    # KEPT
│   ├── pdf-embed-xframe.e2e.spec.ts # KEPT
│   ├── lesson-chat-history.e2e.spec.ts  # KEPT
│   ├── memory-system.e2e.spec.ts     # KEPT
│   ├── v2-*.e2e.spec.ts             # KEPT
│   ├── course-selection.e2e.spec.ts # MIGRATED → scenarios
│   └── helpers/
│       ├── auth.ts
│       ├── courses.ts
│       └── verification-fixtures.ts
```

---

---

## User Stories Layer

Currently the system has **journeys** but no formal **user stories**. We should add this layer for better traceability.

### User Story Structure

```json
{
  "id": "US-EXERCISE-001",
  "story": "As a student, I want to answer MCQ questions so that I can test my understanding",
  "criteria": [
    "Given I'm on a lesson page with an MCQ exercise",
    "When I select an answer and click Check",
    "Then I should see correct/incorrect feedback"
  ],
  "scenarios": ["solve-mcq-correct", "solve-mcq-incorrect"],
  "priority": "must-have",
  "jira": "AG-123"
}
```

### User Stories to Define (15-20)

| ID | Story | Priority | Scenarios |
|----|-------|----------|-----------|
| US-AUTH-001 | Login as student | must-have | auth-student-login |
| US-AUTH-002 | Logout | must-have | auth-student-logout |
| US-AUTH-003 | Guest encounters gated content | must-have | access-gate-mandatory |
| US-AUTH-004 | Guest upgrade to authenticated | should-have | auth-guest-upgrade |
| US-NAV-001 | Browse course catalog | must-have | navigate-course-catalog |
| US-NAV-002 | Navigate to lesson | must-have | navigate-course-to-lesson |
| US-NAV-003 | Switch course tabs | should-have | course-tab-navigation |
| US-EXERCISE-001 | Solve MCQ correctly | must-have | solve-mcq-correct |
| US-EXERCISE-002 | Solve MCQ incorrectly | must-have | solve-mcq-incorrect |
| US-EXERCISE-003 | Solve T/F | must-have | solve-true-false-correct |
| US-EXERCISE-004 | Solve free response | must-have | solve-free-response |
| US-EXERCISE-005 | Solve matching | should-have | solve-matching-correct |
| US-EXERCISE-006 | Request hint when stuck | should-have | help-system-hint |
| US-EXERCISE-007 | Request solution after hint | should-have | help-system-solution-unlock |
| US-CHAT-001 | Chat with AI in lesson | should-have | chat-send-message-in-lesson |
| US-CHAT-002 | Chat with AI on /ask page | should-have | chat-send-message-standalone |
| US-LESSON-001 | Complete a lesson | must-have | lesson-pager-start-to-complete |
| US-ONBOARD-001 | Onboarding flow | should-have | onboarding-greeting-flow |
| US-STUDY-001 | Create study plan | could-have | study-plan-create |
| US-ACCOUNT-001 | View account settings | could-have | account-view-profile |

### Implementation

User stories would be stored in `tests/qa/student/user-stories/` directory:

```
tests/qa/student/
├── user-stories/
│   ├── auth.json        # Authentication stories
│   ├── navigation.json   # Navigation stories
│   ├── exercises.json    # Exercise stories
│   ├── chat.json        # Chat stories
│   └── ...
```

Benefits:
- QA agent can generate scenarios from stories
- Product owner can review stories without code
- Better coverage tracking (story → scenario → test)
- Helps prioritize scenario development

---

## Next Steps

1. **Approve this plan** (stakeholder sign-off)
2. **Phase 1 kickoff** — Implement new actions and selector resilience
3. **Frontend coordination** — Request `data-testid` additions
4. **Define user stories** — Workshop with product to define 15-20 user stories
5. **Weekly sync** — Review progress against metrics
6. **Phase 2 trigger** — Start scenario expansion after Phase 1 complete
