# Scenario-Driven QA Architecture for A-Guy Student Web App

> **Status**: Proposal  
> **Date**: 2026-03-14  
> **Scope**: Student-facing application only. Admin flows excluded.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Student User Journeys](#2-student-user-journeys)
3. [Scenario JSON Schema](#3-scenario-json-schema)
4. [Student Action Vocabulary](#4-student-action-vocabulary)
5. [Action Handler Structure](#5-action-handler-structure)
6. [Folder Structure](#6-folder-structure)
7. [Scenario Categories and Selection Strategy](#7-scenario-categories-and-selection-strategy)
8. [Scenario Runner](#8-scenario-runner)
9. [First 10–15 Scenarios](#9-first-1015-scenarios)
10. [Migration from Existing Tests](#10-migration-from-existing-tests)
11. [Scenario Authoring Rules](#11-scenario-authoring-rules)
12. [QA Agent Readiness](#12-qa-agent-readiness)
13. [Scenario Templates / Patterns](#13-scenario-templates--patterns)
14. [Governance Rules](#14-governance-rules)
15. [CI Integration](#15-ci-integration)
16. [Implementation Phases](#16-implementation-phases)
17. [Risks and Tradeoffs](#17-risks-and-tradeoffs)

---

## 1. Architecture Overview

```
Student Journeys          (behavioral domains — what the product does)
      ↓
Student Scenarios         (JSON files — specific user behaviors)
      ↓
Student Action Vocabulary (24 named actions — user intent)
      ↓
Scenario Runner           (TypeScript — orchestrates seed → execute → teardown)
      ↓
Playwright Execution      (action handlers — Playwright interactions)
```

Each layer has one responsibility:

- **Journeys** describe the product for humans and AI agents.
- **Scenarios** are pure JSON — no code, no selectors.
- **Actions** are the stable contract between scenarios and Playwright.
- **Handlers** contain all DOM selectors and browser interaction logic.
- **Runner** loads JSON, seeds data, executes steps, and tears down.

---

## 2. Student User Journeys

Derived from the actual A-Guy product. These are behavioral domains, not test suites.

| Journey ID | Journey Name | Description | Entry Points |
|---|---|---|---|
| `student-onboarding` | Student Onboarding | First-time visitor goes through greeting flow, selects mood/grade, reaches study hub | `/start`, `/` |
| `student-auth` | Student Authentication | Login via Google OAuth or email/password, logout, guest-to-authenticated upgrade | `/login` |
| `student-navigates-content` | Student Navigates Content | Browse courses, chapters, lessons through the content hierarchy | `/courses` |
| `student-studies-lesson` | Student Studies Lesson | Enter a lesson, page through exercises, use the help system, complete the lesson | `/courses/.../lessons/[slug]` |
| `student-solves-exercises` | Student Solves Exercises | Answer MCQ, T/F, free response, matching questions; check answers; get feedback | Exercise pager within lesson |
| `student-chats-with-ai` | Student Chats with AI Tutor | Open chat in lesson context or standalone `/ask`, send messages, receive streaming AI responses | Chat sidebar or `/ask` |
| `student-manages-account` | Student Manages Account | View/edit account, change teacher persona, view selected course | `/account` |
| `student-plans-study` | Student Plans Study | Create a 7-day study plan with exam date and topics | `/study-plan` |
| `student-accesses-gated-content` | Student Accesses Gated Content | Encounter access gates (free/gated/mandatory), see modals, authenticate to continue | Any gated course/lesson |

**Storage**: `tests/qa/student/journeys/index.ts` — typed array of journey definitions.

```typescript
// tests/qa/student/journeys/index.ts
export interface Journey {
  id: string
  name: string
  description: string
  entryPoints: string[]
  relatedScenarios: string[]
}

export const studentJourneys: Journey[] = [
  {
    id: 'student-onboarding',
    name: 'Student Onboarding',
    description: 'First-time visitor goes through greeting flow, selects mood and grade, reaches study hub',
    entryPoints: ['/start', '/'],
    relatedScenarios: ['onboarding-greeting-flow', 'onboarding-course-selection']
  },
  // ... remaining journeys
]
```

---

## 3. Scenario JSON Schema

### Zod Schema Definition

```typescript
// tests/qa/student/schema/scenario.schema.ts
import { z } from 'zod'

const StepInputSchema = z.record(z.unknown())

const StepSchema = z.object({
  action: z.string().min(1),
  input: StepInputSchema.optional(),
  description: z.string().optional(),
})

const PreconditionSchema = z.object({
  action: z.literal('seed'),
  entity: z.enum(['user', 'course', 'chapter', 'lesson', 'exercise', 'conversation']),
  data: z.record(z.unknown()),
  ref: z.string().min(1), // reference key used in steps, e.g. "$course"
})

export const ScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  journey: z.string().min(1),
  type: z.enum(['core', 'feature', 'edge']),
  area: z.enum([
    'auth', 'onboarding', 'navigation', 'lessons',
    'exercises', 'chat', 'account', 'study-plan', 'access-control'
  ]),
  tags: z.array(z.string()).optional(),
  locale: z.enum(['he', 'en']).default('he'),
  preconditions: z.array(PreconditionSchema).optional(),
  steps: z.array(StepSchema).min(1),
  teardown: z.enum(['auto', 'manual']).default('auto'),
})
```

### Full Example Scenario (from the real system)

```json
{
  "id": "student-solves-mcq-exercise",
  "name": "Student solves an MCQ exercise and sees correct feedback",
  "journey": "student-solves-exercises",
  "type": "core",
  "area": "exercises",
  "tags": ["mcq", "feedback"],
  "locale": "he",
  "preconditions": [
    {
      "action": "seed",
      "entity": "course",
      "data": {
        "title": "Test Algebra",
        "courseLabel": "ח",
        "status": "published",
        "isActive": true,
        "accessType": "free"
      },
      "ref": "$course"
    },
    {
      "action": "seed",
      "entity": "chapter",
      "data": {
        "title": "Fractions",
        "course": "$course",
        "status": "published",
        "isActive": true
      },
      "ref": "$chapter"
    },
    {
      "action": "seed",
      "entity": "lesson",
      "data": {
        "title": "Adding Fractions",
        "chapter": "$chapter",
        "type": "learning",
        "status": "published",
        "isActive": true
      },
      "ref": "$lesson"
    },
    {
      "action": "seed",
      "entity": "exercise",
      "data": {
        "title": "MCQ Exercise",
        "lesson": "$lesson",
        "content": {
          "blocks": [
            {
              "id": "q1",
              "type": "question_select",
              "variant": "mcq",
              "question": { "text": "What is 1/2 + 1/4?" },
              "options": [
                { "id": "a", "value": "3/4" },
                { "id": "b", "value": "2/6" },
                { "id": "c", "value": "1/3" }
              ],
              "answer": { "correctOptionIds": ["a"], "multiSelect": false }
            }
          ]
        }
      },
      "ref": "$exercise"
    },
    {
      "action": "seed",
      "entity": "user",
      "data": { "role": "student" },
      "ref": "$student"
    }
  ],
  "steps": [
    { "action": "login", "input": { "userRef": "$student" } },
    { "action": "openLesson", "input": { "courseRef": "$course", "chapterRef": "$chapter", "lessonRef": "$lesson" } },
    { "action": "startLesson" },
    { "action": "submitAnswer", "input": { "questionIndex": 0, "value": { "type": "mcq", "selectedIds": ["a"] } } },
    { "action": "checkAnswer", "input": { "questionIndex": 0 } },
    { "action": "expectFeedback", "input": { "questionIndex": 0, "correct": true } }
  ],
  "teardown": "auto"
}
```

### Key Design Decisions

- **`preconditions`** seed data via Payload Local API before the scenario runs. Each seeded entity gets a `ref` key (e.g., `$course`) that steps can reference.
- **`teardown: "auto"`** (default) means the runner deletes all seeded entities in reverse dependency order after the scenario completes (exercises → lessons → chapters → courses → conversations → users).
- **`teardown: "manual"`** is for rare cases where a scenario needs custom cleanup logic.
- **No selectors in scenarios** — the `input` object describes intent (what to answer, which question), never DOM elements.
- **`locale`** defaults to `he` (Hebrew) since that's the primary student locale. Handlers use this to resolve the correct button labels and text assertions.

---

## 4. Student Action Vocabulary

**24 actions** organized by domain. Each maps 1:1 to a handler file.

### Session (3 actions)

| Action | Input | Description |
|---|---|---|
| `login` | `{ userRef: string }` | Authenticate via Payload Local API + cookie injection (existing pattern from `tests/e2e/helpers/auth.ts`) |
| `logout` | `{}` | Click user dropdown → logout |
| `startAsGuest` | `{}` | Continue without login (clear auth cookies) |

### Navigation (6 actions)

| Action | Input | Description |
|---|---|---|
| `openHome` | `{}` | Navigate to `/` or `/start` |
| `openCourses` | `{}` | Navigate to `/courses` catalog |
| `openCourse` | `{ courseRef: string }` | Navigate to `/courses/[slug]` |
| `openLesson` | `{ courseRef, chapterRef, lessonRef: string }` | Navigate to full lesson URL |
| `openTab` | `{ tab: 'study' \| 'practice' \| 'ask' \| 'test' \| 'learn' \| 'exams' }` | Click a navigation tab (NavigationBar or CourseTabs) |
| `navigateBack` | `{}` | Click the back/breadcrumb link |

### Lesson Interaction (4 actions)

| Action | Input | Description |
|---|---|---|
| `startLesson` | `{}` | Click "Start" on the lesson intro page |
| `nextExercise` | `{}` | Click "Next" button in ExercisesPager |
| `previousExercise` | `{}` | Click "Previous" button in ExercisesPager |
| `completeLesson` | `{}` | Click "Complete" on the outro page |

### Exercise Interaction (4 actions)

| Action | Input | Description |
|---|---|---|
| `submitAnswer` | `{ questionIndex: number, value: UserAnswer }` | Fill in an answer. Handler detects question type from `value.type` and executes the right UI interaction |
| `checkAnswer` | `{ questionIndex: number }` | Click "Check Answer" / "בדוק תשובה" button (skipped for T/F which auto-checks) |
| `requestHint` | `{ questionIndex: number }` | Click "Hint" / "רמז" button in HelpSystem |
| `requestSolution` | `{ questionIndex: number }` | Click "Solution" / "פתרון" button (requires hint + guiding question first) |

### Chat (3 actions)

| Action | Input | Description |
|---|---|---|
| `sendChatMessage` | `{ text: string }` | Type and send a message in the AI chat sidebar |
| `openAskPage` | `{}` | Navigate to `/ask` standalone chat |
| `expectChatResponse` | `{ contains?: string, timeout?: number }` | Wait for an AI response message to appear in chat |

### Assertions (4 actions)

| Action | Input | Description |
|---|---|---|
| `expectVisible` | `{ text: string, timeout?: number }` | Assert text is visible on page |
| `expectNotVisible` | `{ text: string }` | Assert text is NOT visible |
| `expectUrl` | `{ pattern: string }` | Assert current URL matches regex pattern |
| `expectFeedback` | `{ questionIndex: number, correct: boolean }` | Assert exercise feedback state (correct/incorrect styling and text) |

### UserAnswer Type (for `submitAnswer`)

```typescript
type UserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; value: boolean }
  | { type: 'free_response'; value: string }
  | { type: 'matching'; connections: Array<{ leftId: string; rightId: string }> }
```

The handler inspects `value.type` and executes the appropriate Playwright interactions:

- **MCQ**: Clicks the label/option elements matching `selectedIds`
- **True/False**: Clicks the True or False button (auto-triggers check)
- **Free Response**: Fills the textarea with the value
- **Matching**: Clicks left item, then right item for each connection pair

---

## 5. Action Handler Structure

Each handler follows this signature:

```typescript
// tests/qa/student/actions/types.ts
import type { Page } from '@playwright/test'

export interface ActionContext {
  page: Page
  locale: 'he' | 'en'
  refs: Record<string, any>  // resolved precondition refs ($course, $student, etc.)
}

export type ActionHandler = (ctx: ActionContext, input?: Record<string, unknown>) => Promise<void>
```

Example handler:

```typescript
// tests/qa/student/actions/checkAnswer.ts
import { expect } from '@playwright/test'
import type { ActionHandler } from './types'

const LABELS = {
  he: 'בדוק תשובה',
  en: 'Check Answer',
}

export const checkAnswer: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const label = LABELS[locale]

  // Find all Check Answer buttons, click the one at questionIndex
  const buttons = page.getByRole('button', { name: label })
  const index = (input?.questionIndex as number) ?? 0
  await buttons.nth(index).click()

  // Wait for check to complete (button text changes or feedback appears)
  await page.waitForTimeout(500) // allow async check (free response hits API)
}
```

### Selector Strategy

Current exercise components have **zero `data-testid` attributes**. Phase 1 handlers use:

1. `getByRole('button', { name: /label/i })` — for buttons with text
2. `getByText(label)` — for visible text
3. `locator('[aria-label="..."]')` — for elements with aria labels (SVG hotspots)
4. Positional selectors (`nth()`) — for repeating elements like question cards

**Phase 2 recommendation**: Add `data-testid` attributes to key exercise components for robustness.

---

## 6. Folder Structure

```
tests/
  qa/
    student/
      journeys/
        index.ts                    # Journey definitions (typed array)

      scenarios/
        core/
          auth-login.json
          navigate-course-hierarchy.json
          solve-mcq-exercise.json
          solve-true-false-exercise.json
          solve-free-response-exercise.json
          lesson-pager-flow.json
          chat-send-message.json
        feature/
          onboarding-greeting-flow.json
          help-system-hint.json
          help-system-solution-unlock.json
          course-tab-navigation.json
          exercise-incorrect-triggers-chat.json
        edge/
          submit-empty-answer.json
          access-gate-mandatory.json
          guest-chat-message-limit.json

      actions/
        types.ts                    # ActionContext, ActionHandler types
        registry.ts                 # Action name → handler map
        # Session
        login.ts
        logout.ts
        startAsGuest.ts
        # Navigation
        openHome.ts
        openCourses.ts
        openCourse.ts
        openLesson.ts
        openTab.ts
        navigateBack.ts
        # Lesson
        startLesson.ts
        nextExercise.ts
        previousExercise.ts
        completeLesson.ts
        # Exercise
        submitAnswer.ts
        checkAnswer.ts
        requestHint.ts
        requestSolution.ts
        # Chat
        sendChatMessage.ts
        openAskPage.ts
        expectChatResponse.ts
        # Assertions
        expectVisible.ts
        expectNotVisible.ts
        expectUrl.ts
        expectFeedback.ts

      runner/
        scenario-runner.ts          # Core runner: load → seed → execute → teardown
        run-scenarios.spec.ts       # Playwright spec file that loads and runs scenarios
        seed.ts                     # Precondition seeder (Payload Local API)
        teardown.ts                 # Cleanup seeded data in reverse dependency order
        ref-resolver.ts             # Resolves $ref references in step inputs
        loader.ts                   # Loads scenario JSON files by category
        reporter.ts                 # Result collection and formatting

      schema/
        scenario.schema.ts          # Zod schema for scenario validation
        validate.ts                 # CLI validator: validates all .json scenario files

      fixtures/
        exercise-content/           # Reusable exercise content JSON blocks
          mcq-simple.json
          true-false-simple.json
          free-response-simple.json
          matching-simple.json

    shared/
      seed-helpers.ts               # Wraps existing tests/e2e/helpers/auth.ts + courses.ts
      locales.ts                    # Label maps per locale (button text, etc.)
```

**Key separations:**

- `scenarios/` — pure JSON, no code. AI agent reads/writes here.
- `actions/` — Playwright interaction code. Selectors live only here.
- `runner/` — orchestration. Small and stable.
- `fixtures/` — reusable exercise content blocks for preconditions.
- `shared/` — adapts existing E2E helpers for the scenario system.

---

## 7. Scenario Categories and Selection Strategy

### Categories

| Category | Definition | Example Scenarios | Count Target |
|---|---|---|---|
| **core** | Critical student flows that must never break. Authentication, basic navigation, exercise answering. | Login, open course, solve MCQ, lesson pager | 7–10 |
| **feature** | Tests tied to specific features. Each covers one product capability. | Help system, greeting flow, tab navigation, chat | 10–15 |
| **edge** | Boundary conditions, error states, and failure scenarios. | Empty answer, 404 pages, guest limits, gated access | 5–10 |

### Selection Strategy

| Trigger | What Runs | Expected Duration |
|---|---|---|
| **Pull Request** (any → `main`) | All `core` scenarios | ~2–3 minutes |
| **Merge to `main`** | `core` + `feature` scenarios | ~5–8 minutes |
| **Nightly** (scheduled) | `core` + `feature` + `edge` | ~10–15 minutes |

---

## 8. Scenario Runner

### Core Runner

```typescript
// tests/qa/student/runner/scenario-runner.ts

import type { Page } from '@playwright/test'
import { actionRegistry } from '../actions/registry'
import { seedPreconditions } from './seed'
import { teardownPreconditions } from './teardown'
import { resolveRefs } from './ref-resolver'
import { ScenarioSchema } from '../schema/scenario.schema'

export interface ScenarioResult {
  scenarioId: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  failedStep?: { index: number; action: string; error: string }
}

export async function runScenario(
  page: Page,
  scenarioPath: string,
): Promise<ScenarioResult> {
  const raw = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'))
  const scenario = ScenarioSchema.parse(raw) // validates on load

  const refs: Record<string, any> = {}
  const start = Date.now()

  try {
    // 1. Seed preconditions
    if (scenario.preconditions?.length) {
      await seedPreconditions(scenario.preconditions, refs)
    }

    // 2. Execute steps
    const ctx: ActionContext = { page, locale: scenario.locale, refs }

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i]
      const handler = actionRegistry[step.action]

      if (!handler) {
        throw new Error(`Unknown action: "${step.action}"`)
      }

      const resolvedInput = step.input ? resolveRefs(step.input, refs) : undefined
      await handler(ctx, resolvedInput)
    }

    return { scenarioId: scenario.id, status: 'passed', duration: Date.now() - start }

  } catch (error) {
    return {
      scenarioId: scenario.id,
      status: 'failed',
      duration: Date.now() - start,
      failedStep: { /* captured from error context */ },
    }

  } finally {
    // 3. Teardown — ALWAYS runs, deletes seeded data in reverse dependency order
    if (scenario.teardown === 'auto' && Object.keys(refs).length > 0) {
      await teardownPreconditions(refs)
    }
  }
}
```

### Seed

```typescript
// tests/qa/student/runner/seed.ts
import { getPayload } from 'payload'
import config from '@payload-config'

export async function seedPreconditions(
  preconditions: Precondition[],
  refs: Record<string, any>,
): Promise<void> {
  const payload = await getPayload({ config })

  for (const pre of preconditions) {
    const resolvedData = resolveRefs(pre.data, refs)

    const doc = await payload.create({
      collection: entityToCollection(pre.entity),
      data: {
        ...resolvedData,
        slug: resolvedData.slug || generateUniqueSlug(pre.entity),
      },
      overrideAccess: true,
    })

    // Store full doc with collection metadata for teardown
    refs[pre.ref] = { ...doc, _collection: entityToCollection(pre.entity) }
  }
}
```

### Teardown

```typescript
// tests/qa/student/runner/teardown.ts
// Deletes all seeded entities in reverse dependency order

const DELETION_ORDER = ['exercise', 'lesson', 'chapter', 'course', 'conversation', 'user']

export async function teardownPreconditions(refs: Record<string, any>): Promise<void> {
  const payload = await getPayload({ config })

  // Sort refs by deletion order (children first)
  const sorted = Object.entries(refs).sort(([, a], [, b]) => {
    const aOrder = DELETION_ORDER.indexOf(a._collection || '')
    const bOrder = DELETION_ORDER.indexOf(b._collection || '')
    return aOrder - bOrder
  })

  for (const [refKey, doc] of sorted) {
    try {
      await payload.delete({
        collection: doc._collection,
        id: doc.id,
        overrideAccess: true,
      })
    } catch {
      // Silently continue — entity may have been cascade-deleted
    }
  }
}
```

### Playwright Spec Integration

```typescript
// tests/qa/student/runner/run-scenarios.spec.ts
import { test } from '@playwright/test'
import { runScenario } from './scenario-runner'
import { loadScenarios } from './loader'

const category = (test as any).info?.project?.use?.scenarioCategory || 'core'
const scenarios = loadScenarios(category)

for (const scenarioPath of scenarios) {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'))

  test(scenario.name, async ({ page }) => {
    const result = await runScenario(page, scenarioPath)
    if (result.status === 'failed') {
      throw new Error(
        `Step ${result.failedStep?.index}: ${result.failedStep?.action} — ${result.failedStep?.error}`
      )
    }
  })
}
```

---

## 9. First 10–15 Scenarios

Ordered by priority and dependency.

### Core (7 scenarios)

| # | Scenario ID | Journey | Description |
|---|---|---|---|
| 1 | `auth-student-login` | `student-auth` | Seed student user, login via API, verify redirect to `/` and user greeting in header |
| 2 | `navigate-course-catalog` | `student-navigates-content` | Open `/courses`, verify at least one course card is visible |
| 3 | `navigate-course-to-lesson` | `student-navigates-content` | Seed course hierarchy, navigate from course → chapter → lesson page |
| 4 | `lesson-pager-start-to-complete` | `student-studies-lesson` | Seed lesson with 2 exercises, start lesson, page through, reach completion |
| 5 | `solve-mcq-correct` | `student-solves-exercises` | Seed MCQ exercise, select correct option, check answer, verify "Correct" feedback |
| 6 | `solve-true-false-correct` | `student-solves-exercises` | Seed T/F exercise, click correct button, verify auto-check shows correct feedback |
| 7 | `solve-free-response` | `student-solves-exercises` | Seed free response exercise, type answer, check answer (hits `/api/exercises/validate-answer`) |

### Feature (5 scenarios)

| # | Scenario ID | Journey | Description |
|---|---|---|---|
| 8 | `onboarding-greeting-flow` | `student-onboarding` | Visit `/start`, go through greeting → mood → course selection → arrive at `/study` |
| 9 | `help-system-hint` | `student-solves-exercises` | Answer incorrectly, click Hint button, verify hint content appears |
| 10 | `help-system-solution-unlock` | `student-solves-exercises` | Use hint + guiding question, verify Solution button becomes visible |
| 11 | `chat-send-message-in-lesson` | `student-chats-with-ai` | Open lesson with chat sidebar, send a message, verify AI response appears |
| 12 | `course-tab-navigation` | `student-navigates-content` | Open course page, switch between Learn/Practice/Ask/Exams tabs |

### Edge (3 scenarios)

| # | Scenario ID | Journey | Description |
|---|---|---|---|
| 13 | `submit-empty-mcq` | `student-solves-exercises` | Try to check answer with no option selected — verify button state/behavior |
| 14 | `access-gate-mandatory` | `student-accesses-gated-content` | Seed mandatory-access course, visit as guest, verify non-dismissible login modal |
| 15 | `exercise-404` | `student-navigates-content` | Navigate to non-existent exercise URL, verify 404 response |

---

## 10. Migration from Existing Tests

### Tests to Migrate (convert to scenarios)

| Current Test | Target Scenario | Reason |
|---|---|---|
| `course-selection.e2e.spec.ts` test 1 (localStorage update) | `onboarding-greeting-flow` + `navigate-course-catalog` | Behavioral flow that maps to a journey |
| `course-selection.e2e.spec.ts` test 3 (navigation after selection) | `navigate-course-to-lesson` | Navigation flow |
| `exercise-page.e2e.spec.ts` (skipped MCQ/TF/Free tests) | `solve-mcq-correct`, `solve-true-false-correct`, `solve-free-response` | Always intended as scenario-like tests but lacked seeding |
| `frontend.e2e.spec.ts` (homepage smoke) | `navigate-course-catalog` | Simple homepage smoke |

### Tests to Keep as Plain Playwright Tests

**Criteria for staying as plain tests:**

1. **Infrastructure tests** — Verify technical plumbing, not user behavior (e.g., version footer)
2. **API-only tests** — Mock network responses, never exercise real UI flows
3. **Admin-scoped tests** — V2 conversion panels, admin dashboards (out of scope)
4. **External service tests** — Require specific API keys (memory system, chat history with real AI)
5. **Low-level regression tests** — Specific bug fix validations (e.g., canvas fix)

| Current Test | Keep As-Is | Reason |
|---|---|---|
| `version-footer.e2e.spec.ts` | Yes | Infrastructure check, not a user journey |
| `lesson-chat-history.e2e.spec.ts` | Yes | Requires real `OPENAI_API_KEY`, tests API behavior |
| `memory-system.e2e.spec.ts` | Yes | Requires real AI keys, tests backend memory pipeline |
| `v2-canvas-fix.e2e.spec.ts` | Yes | Admin conversion pipeline (out of scope) |
| `v2-error-display.e2e.spec.ts` | Yes | Admin conversion panel (out of scope) |
| `v2-conversion-panel.e2e.spec.ts` | Yes | Admin conversion panel (out of scope) |

---

## 11. Scenario Authoring Rules

These rules apply to all scenarios — human-written or AI-generated.

1. **One behavior per scenario** — A scenario tests exactly one user behavior. "Student solves MCQ" is one scenario. "Student solves MCQ then opens chat then logs out" is three.

2. **At least one assertion** — Every scenario must include at least one assertion step (`expectVisible`, `expectNotVisible`, `expectUrl`, `expectFeedback`, or `expectChatResponse`).

3. **Approved actions only** — Steps may only reference actions defined in `actions/registry.ts`. Unknown actions cause a validation error at load time.

4. **No selectors in scenarios** — JSON files must never contain CSS selectors, XPaths, `data-testid` values, or DOM structure references. The `input` object describes *what* to do, not *how*.

5. **Semantic naming** — Scenario IDs use `kebab-case` and follow the pattern `{verb}-{noun}[-{qualifier}]`. Examples: `solve-mcq-correct`, `auth-student-login`, `access-gate-mandatory`.

6. **Self-contained preconditions with teardown** — Every scenario seeds its own data and cleans it up after itself. The runner's `finally` block deletes all seeded entities in reverse dependency order. Scenarios must not depend on data from other scenarios.

7. **Idempotent execution** — A scenario can be run any number of times in any order. No shared mutable state between scenarios.

8. **Locale-aware** — Scenarios must declare their `locale`. Handlers use the locale to resolve button labels and assertion text.

---

## 12. QA Agent Readiness

### Files the Agent Reads

| File/Directory | Purpose |
|---|---|
| `tests/qa/student/journeys/index.ts` | Understand all behavioral domains |
| `tests/qa/student/scenarios/**/*.json` | Learn existing scenario patterns |
| `tests/qa/student/actions/registry.ts` | Know what actions are available |
| `tests/qa/student/schema/scenario.schema.ts` | Understand the valid scenario structure |
| `tests/qa/student/fixtures/exercise-content/*.json` | Reuse exercise content blocks |

### Files the Agent Generates

| File | Validation |
|---|---|
| `tests/qa/student/scenarios/{category}/{id}.json` | Validated against `ScenarioSchema` at generation time and on CI |

### Validation Pipeline for Generated Scenarios

```
Agent generates JSON
    ↓
Zod schema validation (scenario.schema.ts)
    ↓
Action existence check (all actions in registry?)
    ↓
Ref consistency check (all $refs defined in preconditions?)
    ↓
Dry-run (optional): load scenario, resolve refs, verify no errors
    ↓
Human review (PR)
    ↓
Merge → CI runs scenario
```

---

## 13. Scenario Templates / Patterns

Reusable patterns that new scenarios follow:

### Pattern A: "Seed → Navigate → Assert"

```json
{
  "preconditions": [{ "action": "seed", "entity": "course", "data": { "..." }, "ref": "$course" }],
  "steps": [
    { "action": "openCourse", "input": { "courseRef": "$course" } },
    { "action": "expectVisible", "input": { "text": "Test Course" } }
  ]
}
```

### Pattern B: "Login → Navigate → Interact → Assert"

```json
{
  "preconditions": [
    { "action": "seed", "entity": "user", "data": { "role": "student" }, "ref": "$student" },
    { "action": "seed", "entity": "course", "data": { "..." }, "ref": "$course" },
    { "action": "seed", "entity": "exercise", "data": { "..." }, "ref": "$exercise" }
  ],
  "steps": [
    { "action": "login", "input": { "userRef": "$student" } },
    { "action": "openLesson", "input": { "courseRef": "$course", "chapterRef": "$chapter", "lessonRef": "$lesson" } },
    { "action": "submitAnswer", "input": { "questionIndex": 0, "value": { "type": "mcq", "selectedIds": ["a"] } } },
    { "action": "checkAnswer", "input": { "questionIndex": 0 } },
    { "action": "expectFeedback", "input": { "questionIndex": 0, "correct": true } }
  ]
}
```

### Pattern C: "Guest → Encounter Gate → Assert"

```json
{
  "preconditions": [
    { "action": "seed", "entity": "course", "data": { "accessType": "mandatory" }, "ref": "$course" }
  ],
  "steps": [
    { "action": "startAsGuest" },
    { "action": "openCourse", "input": { "courseRef": "$course" } },
    { "action": "expectVisible", "input": { "text": "Sign in" } }
  ]
}
```

### Pattern D: "Navigate Sequence → Complete"

```json
{
  "steps": [
    { "action": "openLesson", "input": { "..." } },
    { "action": "startLesson" },
    { "action": "nextExercise" },
    { "action": "nextExercise" },
    { "action": "completeLesson" },
    { "action": "expectUrl", "input": { "pattern": "/complete" } }
  ]
}
```

---

## 14. Governance Rules

### Adding a New Action

1. Propose the action with name, input shape, and description
2. Implement the handler in `tests/qa/student/actions/{actionName}.ts`
3. Register it in `actions/registry.ts`
4. Update the Zod schema if the action introduces new input constraints
5. Write at least one scenario that uses it

### Adding a New Scenario

1. Create `.json` file in the correct category directory (`core/`, `feature/`, `edge/`)
2. Run `pnpm qa:validate` (calls `tests/qa/student/schema/validate.ts`) to verify schema compliance
3. Run the scenario locally: `npx playwright test --project=qa-core --grep "scenario name"`
4. If scenario references a new journey, add the journey to `journeys/index.ts` first

### When a New Feature Needs a New Journey

1. Does the feature fit into an existing journey? Map it there first.
2. If the feature introduces a fundamentally new user flow (e.g., "student takes a timed exam"), create a new journey in `journeys/index.ts`.
3. New journeys must have at least one `core` scenario before being considered established.

### JSON Schema Validation Strategy

- **On commit**: A lint script (`pnpm qa:validate`) validates all `*.json` files in `scenarios/` against `ScenarioSchema`
- **In CI**: Validation runs as part of the `fast-gate` job (no browser needed)
- **Pre-commit hook** (optional): Validate changed scenario files only

---

## 15. CI Integration

The scenario runner integrates as **new Playwright projects** alongside existing E2E tests.

### Playwright Config Additions

```typescript
// playwright.config.ts (additions)
{
  projects: [
    // Existing E2E tests (unchanged)
    {
      name: 'e2e',
      testDir: './tests/e2e',
    },
    // Scenario-driven QA
    {
      name: 'qa-core',
      testDir: './tests/qa/student/runner',
      testMatch: 'run-scenarios.spec.ts',
      use: { scenarioCategory: 'core' },
    },
    {
      name: 'qa-full',
      testDir: './tests/qa/student/runner',
      testMatch: 'run-scenarios.spec.ts',
      use: { scenarioCategory: ['core', 'feature'] },
    },
    {
      name: 'qa-nightly',
      testDir: './tests/qa/student/runner',
      testMatch: 'run-scenarios.spec.ts',
      use: { scenarioCategory: ['core', 'feature', 'edge'] },
    },
  ]
}
```

### CI Workflow Additions

```yaml
# In .github/workflows/ci.yml e2e-system-tests job:
- name: Run QA Core Scenarios
  if: github.event_name == 'pull_request'
  run: npx playwright test --project=qa-core

- name: Run QA Full Scenarios
  if: github.ref == 'refs/heads/main'
  run: npx playwright test --project=qa-full

# Separate nightly workflow:
- name: Run QA Nightly
  schedule: [{ cron: '0 3 * * *' }]
  run: npx playwright test --project=qa-nightly
```

---

## 16. Implementation Phases

### Phase 1 — Foundation (1–2 weeks)

| Deliverable | Description |
|---|---|
| Zod scenario schema | `tests/qa/student/schema/scenario.schema.ts` + validation CLI |
| Journey definitions | `tests/qa/student/journeys/index.ts` with 9 journeys |
| Action type system | `tests/qa/student/actions/types.ts` + `registry.ts` |
| Scenario runner | `tests/qa/student/runner/scenario-runner.ts` with seed/teardown |
| 5 core handlers | `login`, `openLesson`, `submitAnswer`, `checkAnswer`, `expectFeedback` |
| 3 assertion handlers | `expectVisible`, `expectUrl`, `expectFeedback` |
| 3 core scenarios | `auth-student-login`, `navigate-course-to-lesson`, `solve-mcq-correct` |
| Exercise fixtures | `fixtures/exercise-content/mcq-simple.json`, `true-false-simple.json` |

### Phase 2 — Execution (2–3 weeks)

| Deliverable | Description |
|---|---|
| Remaining 19 action handlers | Complete the full 24-action vocabulary |
| 12 more scenarios | Complete the first 15 scenarios + a few more |
| CI integration | `qa-core` Playwright project in CI, runs on PRs |
| Migrate 3 existing tests | Convert `course-selection` and `exercise-page` tests to scenarios |
| Add `data-testid` to key components | Exercise buttons, question cards, help system (makes handlers robust) |

### Phase 3 — Intelligence (3–4 weeks)

| Deliverable | Description |
|---|---|
| Scenario template library | Documented patterns A–D with generator helpers |
| QA agent scenario generation | Agent reads journeys + vocabulary, generates new scenario JSON |
| Validation pipeline | Zod + action check + ref check + dry-run |
| Scenario coverage expansion | 30–40 total scenarios across all categories |
| Nightly workflow | Scheduled CI run for `qa-nightly` project |

---

## 17. Risks and Tradeoffs

| Risk | Severity | Mitigation |
|---|---|---|
| **No `data-testid` in exercise components** | Medium | Phase 1 handlers use `getByRole`/`getByText` (Playwright-recommended). Phase 2 adds `data-testid` for robustness. |
| **Free response checking is async (hits API)** | Low | Handler includes a wait for feedback to appear. Timeout configurable. |
| **Per-scenario seeding is slower than shared fixtures** | Medium | ~200–500ms per scenario via Local API. Acceptable for 15–40 scenarios. Can add shared base fixture later if needed. |
| **Hebrew locale complicates text assertions** | Low | Handlers use locale-aware label maps. Scenarios declare locale explicitly. |
| **Chat/AI responses are non-deterministic** | Medium | Chat scenarios use `expectChatResponse` with `contains` (substring) and generous timeouts. Edge scenarios may need API mocking. |
| **Running scenarios in parallel may cause data collisions** | Low | Unique timestamp-based slugs per entity (existing pattern). Teardown deletes by ID, not slug pattern. |
| **Dual test systems during transition** | Low | Both run side by side in separate Playwright projects. No migration deadline. |
