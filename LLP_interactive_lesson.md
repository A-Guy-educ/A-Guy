# Interactive Lesson Demo v1 — Low-Level Plan (LLP)

## Context

**Problem**: The platform currently supports only PDF/static content + exercise/chat lesson flows. We need a new `interactive_demo` lesson type that provides a block-based, backend-driven interactive lesson experience with MCQ/open questions, AI remediation, and controlled progression.

**Branch**: `Interactive_Lesson_Demo` (current)
**Isolation guarantee**: No behavioral changes to existing flows; only additive code paths gated by `lesson.type === 'interactive_demo'` and the `interactive_demo.enabled` feature flag. Existing chat, exercise, PDF, and guest session systems are untouched.

### UX Reference Prototype

**File**: [`docs/demos/aguy_demo_full_block_based_styled.html`](docs/demos/aguy_demo_full_block_based_styled.html)

A standalone HTML demo (open in browser) that demonstrates the target UX for the interactive lesson flow. It shows:

- **Block-based progression**: Content, MCQ, open-response, and explanation blocks rendered sequentially in a scrollable stream
- **Typewriter effect**: Character-by-character reveal with fast-forward on "Continue" click; second click advances to next block
- **MCQ interaction**: Large clickable buttons (single-select), immediate correct/incorrect feedback, skill score tracking
- **Open-response input**: Text input with submit button, deterministic feedback on submission
- **Remediation flow**: On incorrect MCQ answer, a remediation explanation block is injected followed by an easier follow-up question — the block index does NOT advance
- **Check-in blocks**: Periodic "is this clear?" prompts with "continue" or "explain more" options
- **Emotion detection opener**: Tone-setting question at lesson start that adjusts the AI personality
- **Sidebar panel**: Live skill score, tone indicator, blocks-shown counter, and event log
- **Progress bar**: Visual progress through the lesson script
- **RTL Hebrew layout**: Full right-to-left support matching our target locale
- **Reset**: "Start Over" button at lesson completion

The demo's `LESSON` JSON array is the conceptual equivalent of our `lessonScript` field. Key differences from our implementation:

| Demo (HTML prototype)                                                                                      | Our implementation (LLP)                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Client-side state machine                                                                                  | Server-authoritative state machine via `/api/lessons/step`                                                   |
| `LESSON` array in `<script>`                                                                               | `lessonScript` JSON field on Lessons collection, validated by Zod                                            |
| Block types: `emotion`, `checkin`, `text`, `explain`, `mcq`, `open`, `media_question`, `graph_help`, `end` | Block types: `content`, `mcq`, `open` (emotion/checkin/end are future; media via `media` field on any block) |
| Inline correct/incorrect check                                                                             | `evaluateMcq` / `evaluateOpen` on server, `isCorrect` + `feedback` in `StepResponse`                         |
| No persistence                                                                                             | `LessonSessions` collection with full history, optimistic locking, idempotent retries                        |
| No auth                                                                                                    | Authenticated + owner-scoped access control                                                                  |
| Direct DOM manipulation                                                                                    | React components: `BlockStream`, `McqBlock`, `OpenBlock`, `ContentBlock`, etc.                               |
| Canvas annotation overlay                                                                                  | Out of scope for Demo v1 (future enhancement)                                                                |
| Notebook right pane                                                                                        | Out of scope for Demo v1 (future enhancement)                                                                |

---

## Phase 0: Constants, Types & Feature Flag Foundation

### 0.1 Extend Lesson Types

**File**: `src/server/constants/lesson-types.ts`

- Add `'interactive_demo'` to the `LESSON_TYPES` const array
- The `LessonType` union type auto-updates (derived from `typeof LESSON_TYPES[number]`)
- `getEffectiveLessonType` auto-handles it via `includes()` check — no changes needed

### 0.2 Add Config Domain for Feature Flag

**File**: `src/infra/config/config-constants.ts`

- Add `InteractiveDemo: 'interactive_demo'` to `ConfigDomain` object

### 0.3 Create Feature Flag Config Accessor

**New file**: `src/server/config/interactive-demo-config.ts`

- Follow `guest-chat-config.ts` pattern exactly
- Interface: `InteractiveDemoConfig { enabled: boolean }`
- Default: `{ enabled: false }`
- Function: `getInteractiveDemoConfig(tenantId?: string): Promise<InteractiveDemoConfig>`
- Uses `getConfigDomain(ConfigDomain.InteractiveDemo, { throwIfNotFound: false })`

> **FIX #14 — Feature flag enablement guide** (prevents "Coming Soon forever"):
>
> To enable the interactive demo feature, create/update a document in the `config-values` Payload collection:
>
> | Field    | Value                                                 |
> | -------- | ----------------------------------------------------- |
> | `domain` | `interactive_demo`                                    |
> | `key`    | `enabled`                                             |
> | `value`  | `true`                                                |
> | `tenant` | _(optional — omit for global, set for tenant-scoped)_ |
>
> - **Admin panel**: Navigate to `/admin/collections/config-values` → Create New → set fields above.
> - **API / seed script**: `payload.create({ collection: 'config-values', data: { domain: 'interactive_demo', key: 'enabled', value: true } })`
> - **Per-tenant**: Set `tenant` field to scope enablement to a specific tenant. Global config (no tenant) applies as fallback.
> - **Verify**: Call `getInteractiveDemoConfig()` — should return `{ enabled: true }`. If the config-values document doesn't exist, the default is `{ enabled: false }` and the gate renders "Coming Soon".

### 0.4 Extend API Error Codes

**File**: `src/server/api/responses.ts`

- Add to `ApiErrorCode` union:
  - `'FEATURE_DISABLED'`
  - `'SESSION_NOT_FOUND'`
  - `'SESSION_CONFLICT'`
  - `'INVALID_STATE_TRANSITION'`
  - `'RATE_LIMITED'`
  - `'LESSON_NOT_INTERACTIVE'`

### 0.5 Register LLM Model Key

**File**: `src/infra/llm/models.ts`

- Add `'INTERACTIVE_REMEDIATION'` to `AIModelKey` union
- Add entry to `MODEL_REGISTRY`: `{ temperature: 0.4, maxOutputTokens: 1024, capabilities: ['chat', 'remediation'] }`
- Add entries to `PROVIDER_MODEL_NAMES` for both Gemini and OpenAI-compatible providers
- Add backward-compat entry to `AI_MODELS`

---

## Phase 1: Lesson Collection Extension

### 1.1 Add Fields to Lessons Collection

**File**: `src/server/payload/collections/Lessons.ts`

Add `'interactive_demo'` option to the `type` select field:

```
{ label: 'Interactive Demo', value: 'interactive_demo' }
```

Add new fields (in a group, after `contentFiles` section):

```typescript
// --- Interactive Demo Fields ---
{
  name: 'lessonScript',
  type: 'json',
  admin: {
    description: 'JSON lesson script for interactive_demo lessons (blocks array)',
    condition: (data) => data?.type === 'interactive_demo',
  },
},
{
  name: 'remediationEnabled',
  type: 'checkbox',
  defaultValue: true,
  admin: {
    description: 'Enable AI remediation for incorrect answers',
    condition: (data) => data?.type === 'interactive_demo',
    position: 'sidebar',
  },
},
{
  name: 'typewriterEnabled',
  type: 'checkbox',
  defaultValue: true,
  admin: {
    description: 'Enable typewriter reveal animation',
    condition: (data) => data?.type === 'interactive_demo',
    position: 'sidebar',
  },
},
{
  name: 'adaptivityEnabled',
  type: 'checkbox',
  defaultValue: true,
  admin: {
    description: 'Enable basic skill score adaptivity',
    condition: (data) => data?.type === 'interactive_demo',
    position: 'sidebar',
  },
},
```

### 1.2 LessonScript Schema (Zod Validation)

**New file**: `src/server/payload/collections/Lessons/interactive-demo-schema.ts`

Reuses `InlineRichText` pattern from `src/shared/exercise-content/types.ts`.

> **FIX #1 — MCQ single-select enforced**: `correctOptionIds` is constrained to `.length(1)`. Demo v1 MCQ is single-correct only; multi-select is a future enhancement.

```typescript
const DemoInlineRichTextSchema = z
  .object({
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string().max(5000),
    mediaIds: z.array(z.string().min(1)).default([]),
  })
  .strict()

const ContentBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('content'),
    content: DemoInlineRichTextSchema,
    media: z.string().optional(),
  })
  .strict()

const McqOptionSchema = z
  .object({
    id: z.string().min(1),
    content: DemoInlineRichTextSchema,
  })
  .strict()

// Demo v1: single-correct only. correctOptionIds must have exactly 1 entry.
const McqBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mcq'),
    prompt: DemoInlineRichTextSchema,
    options: z.array(McqOptionSchema).min(2).max(6),
    correctOptionIds: z.array(z.string().min(1)).length(1), // FIX #1: exactly 1
    remediationPrompt: z.string().max(2000).optional(),
    media: z.string().optional(),
  })
  .strict()
  .superRefine((block, ctx) => {
    // Validate the single correctOptionId exists in options
    const optionIds = new Set(block.options.map((o) => o.id))
    const missing = block.correctOptionIds.filter((id) => !optionIds.has(id))
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `correctOptionIds contains unknown option id: ${missing.join(', ')}`,
        path: ['correctOptionIds'],
      })
    }
  })

const OpenBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('open'),
    prompt: DemoInlineRichTextSchema,
    acceptedAnswers: z.array(z.string().min(1)).min(1).max(10),
    answerFormatHint: z.string().max(200).optional(), // FIX #13: optional per-block hint for incorrect feedback
    remediationPrompt: z.string().max(2000).optional(),
    media: z.string().optional(),
  })
  .strict()

const ScriptBlockSchema = z.discriminatedUnion('type', [
  ContentBlockSchema,
  McqBlockSchema,
  OpenBlockSchema,
])

export const LessonScriptSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(ScriptBlockSchema).min(1).max(50),
  })
  .strict()
  .superRefine((script, ctx) => {
    // Validate unique block IDs
    const ids = script.blocks.map((b) => b.id)
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate block id: ${id}`,
          path: ['blocks'],
        })
      }
      seen.add(id)
    }
  })
```

### 1.3 Add Validation Hooks to Lessons

**File**: `src/server/payload/collections/Lessons.ts`

**Hook A — Schema validation** (`beforeValidate`):

- Import `LessonScriptSchema` from the new schema file
- If `data.type === 'interactive_demo'` and `data.lessonScript` is present, run `LessonScriptSchema.safeParse(data.lessonScript)`
- On failure, throw validation error with detailed issues

> **FIX #4 — Block lessonScript edits when active sessions exist** (`beforeChange`):

**Hook B — Active session guard** (`beforeChange`):

- Only applies to `update` operation, only when `type === 'interactive_demo'`
- Compare `data.lessonScript` against the existing doc's `lessonScript` (deep equality via `JSON.stringify`)
- If changed, query `lesson-sessions` collection for any doc where `lesson === doc.id` AND `status === 'active'`
- If any active session found → throw validation error: "Cannot modify lessonScript while active sessions exist. Complete or reset all active sessions first."

```typescript
// In Lessons.ts hooks.beforeChange array:
;async ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update' || data?.type !== 'interactive_demo') return data
  if (!originalDoc?.lessonScript || !data?.lessonScript) return data

  const scriptChanged =
    JSON.stringify(data.lessonScript) !== JSON.stringify(originalDoc.lessonScript)
  if (!scriptChanged) return data

  const activeSessions = await req.payload.find({
    collection: 'lesson-sessions',
    where: {
      lesson: { equals: originalDoc.id },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (activeSessions.docs.length > 0) {
    throw new Error(
      'Cannot modify lessonScript while active sessions exist. ' +
        'Complete or reset all active sessions first.',
    )
  }

  return data
}
```

### 1.4 Regenerate Types

- Run `pnpm generate:types` to update `src/payload-types.ts` with new Lesson fields

---

## Phase 2: Lesson Sessions Collection

### 2.1 Create Collection

**New file**: `src/server/payload/collections/LessonSessions.ts`

> **FIX #3 — Explicit `currentPhase` field** added to the session. Server uses this instead of scanning history.
> **FIX #5 — History as typed `array` field** with `maxRows: 200` for safe cap enforcement.
> **FIX #9 — History hard limits**: `content` field has `maxLength: 5000` to prevent unbounded doc growth. `timestamp` uses Payload `date` type; server writes `new Date()` (not ISO string) for consistency with Payload's date serialization.

```typescript
export const LessonSessions: CollectionConfig = {
  slug: 'lesson-sessions',
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'lesson',
    defaultColumns: [
      'user',
      'lesson',
      'status',
      'currentPhase',
      'currentBlockIndex',
      'skillScore',
      'updatedAt',
    ],
    group: 'Interactive Demo',
  },
  fields: [
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    // FIX #3: Explicit session phase for deterministic state transitions
    {
      name: 'currentPhase',
      type: 'select',
      required: true,
      defaultValue: 'awaiting_continue',
      options: [
        { label: 'Awaiting Input', value: 'awaiting_input' },
        { label: 'Awaiting Continue', value: 'awaiting_continue' },
      ],
      admin: {
        description:
          'Current phase: awaiting_input (question needs answer) or awaiting_continue (ready for next)',
      },
    },
    {
      name: 'currentBlockIndex',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'skillScore',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    // FIX #5: History as typed array field with maxRows for safe cap
    {
      name: 'history',
      type: 'array',
      maxRows: 200,
      admin: {
        description: 'Session interaction history (capped at 200 entries)',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'System', value: 'system' },
            { label: 'User', value: 'user' },
            { label: 'Assistant', value: 'assistant' },
          ],
        },
        {
          name: 'blockType',
          type: 'select',
          required: true,
          options: [
            { label: 'Content', value: 'content' },
            { label: 'MCQ', value: 'mcq' },
            { label: 'Open', value: 'open' },
            { label: 'Remediation', value: 'remediation' },
          ],
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
          maxLength: 5000, // FIX #9: hard limit prevents unbounded doc growth
          admin: {
            description: 'Markdown/math content (md-math-v1)',
          },
        },
        {
          name: 'timestamp',
          type: 'date',
          required: true,
        },
        {
          name: 'metadata',
          type: 'json',
          // { blockIndex, isCorrect?, selectedOptionIds?, normalizedAnswer?, scoreDelta? }
        },
      ],
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'completedAt',
      type: 'date',
    },
    {
      name: 'schemaVersion',
      type: 'number',
      required: true,
      defaultValue: 1,
    },
    {
      name: 'version',
      type: 'number',
      required: true,
      defaultValue: 1,
      // Optimistic concurrency counter
    },
    // FIX #11: processedActions with cached response for true idempotency
    {
      name: 'processedActions',
      type: 'array',
      maxRows: 50,
      admin: {
        description: 'Recent action results for idempotent retry support (FIFO, max 50)',
      },
      fields: [
        {
          name: 'actionId',
          type: 'text',
          required: true,
          index: true,
        },
        {
          name: 'createdAt',
          type: 'date',
          required: true,
        },
        {
          name: 'response',
          type: 'json',
          required: true,
          // Snapshot of the StepResponse returned for this action
        },
      ],
      defaultValue: [],
    },
    {
      name: 'remediationCounts',
      type: 'json',
      // { perBlock: Record<string, number>, total: number }
      defaultValue: { perBlock: {}, total: 0 },
    },
  ],
  timestamps: true,
}
```

### 2.2 Register Collection

**File**: `src/payload.config.ts`

- Import `LessonSessions` from `@/server/payload/collections/LessonSessions`
- Add to `collections` array (after `UserProgress`)

### 2.3 Create Unique Index for Active Sessions

**New file**: `src/server/payload/migrations/createLessonSessionIndex.ts`

```typescript
export async function createLessonSessionIndexes(payload: Payload) {
  const db = payload.db.connection.db
  const collection = db.collection('lesson-sessions')
  await collection.createIndex(
    { user: 1, lesson: 1 },
    { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_session' },
  )
}
```

Register in `payload.config.ts` `onInit` alongside existing `runBackfillOnInit`.

### 2.4 Regenerate Types

- Run `pnpm generate:types`

---

## Phase 3: Step API Endpoint

### 3.1 Request/Response Schemas

**New file**: `src/server/payload/endpoints/interactive-demo/schemas.ts`

> **FIX #2 — `reset` action** added to the action enum.
> **FIX #3 — `currentPhase`** added to response.
> **FIX #11 — Idempotent result cache**: `StepResponse` is the unit cached in `processedActions`. On duplicate `clientActionId`, the handler returns the stored snapshot verbatim — client retries get identical feedback/remediation.

```typescript
export const StepRequestSchema = z.object({
  lessonId: z.string().min(1),
  sessionId: z.string().optional(),
  action: z.enum(['start', 'answer', 'next', 'reset']), // FIX #2: added 'reset'
  answer: z.string().max(2000).optional(),
  selectedOptionIds: z.array(z.string().min(1)).optional(),
  clientActionId: z.string().uuid(),
})

export interface StepResponse {
  sessionId: string
  status: 'active' | 'completed'
  currentBlockIndex: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' // FIX #3
  block: { type: string; content?: object; options?: object[]; media?: string } | null
  skillScore: number
  isCorrect?: boolean // FIX #13: explicit correctness flag for answer actions
  feedback?: string // FIX #13: deterministic UX feedback message
  remediation?: string
  schemaVersion: number
}
```

### 3.2 Step Handler (Core State Machine)

**New file**: `src/server/payload/endpoints/interactive-demo/step-handler.ts`

Core function: `handleStep(payload, user, request) → StepResponse`

#### `start` action:

1. Verify lesson exists AND `type === 'interactive_demo'`
2. Check feature flag via `getInteractiveDemoConfig()` (resolve tenant from lesson)
3. Look for existing active session (`user + lesson + status=active`)
4. If exists → resume (return current state + current block + current phase)
5. If not → create new session with `currentBlockIndex: 0`, determine initial phase:
   - First block is content → `currentPhase: 'awaiting_continue'`
   - First block is mcq/open → `currentPhase: 'awaiting_input'`
6. Append system history entry
7. Return first block (stripped of answers)

#### `answer` action:

1. Load session by `sessionId` (verify ownership via `user`)
2. **FIX #11: Check `clientActionId` idempotency** — search `session.processedActions` for matching `actionId`. If found, return the **cached `response` snapshot** (not current state). This ensures retries get identical feedback/remediation.
3. **FIX #3: Verify `currentPhase === 'awaiting_input'`** — reject with `INVALID_STATE_TRANSITION` if not
4. Verify current block is a question block (mcq/open) — redundant with phase but defense-in-depth
5. Evaluate answer:
   - MCQ: compare single `selectedOptionIds[0]` against `correctOptionIds[0]` (FIX #1: single-select)
   - Open: normalized string compare → whitespace-removed compare → if no match, treat as incorrect (FIX #8: no LLM validation)
6. Update `skillScore` if correct (`+1`)
7. Append user answer + system evaluation to history (via `buildHistoryEntry`)
8. **FIX #3: Set `currentPhase: 'awaiting_continue'`** (answer processed)
9. If incorrect AND remediationEnabled → call remediation service
10. Build the `StepResponse` object
11. **FIX #11: Push `{ actionId: clientActionId, createdAt: new Date(), response: stepResponse }` to `processedActions`** (FIFO cap at 50 — if length exceeds, shift oldest)
12. Increment `version` (optimistic lock: conditional update on `id + version`)
13. Return the `StepResponse`

#### `next` action:

1. Load session, verify ownership
2. **FIX #11: Check `clientActionId` idempotency** — if found in `processedActions`, return cached `response` snapshot
3. **FIX #3: Verify `currentPhase === 'awaiting_continue'`** — reject with `INVALID_STATE_TRANSITION` if not
4. Increment `currentBlockIndex`
5. If `currentBlockIndex >= totalBlocks` → set `status: completed`, set `completedAt`
6. **FIX #3: Set `currentPhase` based on new block type:**
   - content → `awaiting_continue`
   - mcq/open → `awaiting_input`
   - (beyond last block → stays `awaiting_continue`, status is `completed`)
7. Build the `StepResponse` object
8. **FIX #11: Push action result to `processedActions`** (FIFO cap at 50)
9. Optimistic lock update
10. Return next block or completion state

#### `reset` action (FIX #2 — must-have, deterministic):

> **FIX #12 — Authoritative re-read pattern**: The reset algorithm always ends by re-reading the active session from the DB, never trusting the create result. This guarantees deterministic behavior under concurrent reset/start calls.

Robust flow:

1. Verify lesson exists AND `type === 'interactive_demo'`
2. Check feature flag
3. Find current active session for (user, lesson, status=active)
4. If exists → mark it `status: 'completed'`, set `completedAt: now` via **conditional update** (only if still `status: 'active'` — best-effort, ignore failure)
5. Attempt to create a NEW active session:
   - `currentBlockIndex: 0`
   - `skillScore: 0`
   - `history: []`
   - `currentPhase`: determined by first block type (content→`awaiting_continue`, mcq/open→`awaiting_input`)
   - `remediationCounts: { perBlock: {}, total: 0 }`
   - `processedActions: []`
   - `version: 1`
   - If duplicate key error (11000): **ignore and proceed** — another concurrent reset/start won the race
6. **Re-find active session** (user + lesson + status=active) — this is the authoritative read
7. Return `buildStepResponse(activeSession, lesson)` with first block (stripped of answers)

```typescript
async function handleReset(payload, user, lessonId, lesson) {
  // Step 3-4: Best-effort complete existing active session
  const existing = await payload.find({
    collection: 'lesson-sessions',
    where: {
      user: { equals: user.id },
      lesson: { equals: lessonId },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    try {
      await payload.update({
        collection: 'lesson-sessions',
        id: existing.docs[0].id,
        data: { status: 'completed', completedAt: new Date() },
        overrideAccess: true,
      })
    } catch {
      // Best-effort — another request may have already completed it
    }
  }

  // Step 5: Attempt create (may fail with 11000 if concurrent)
  try {
    await payload.create({
      collection: 'lesson-sessions',
      data: {
        user: user.id,
        lesson: lessonId,
        status: 'active',
        currentBlockIndex: 0,
        currentPhase: getInitialPhase(lesson),
        skillScore: 0,
        history: [],
        startedAt: new Date(),
        remediationCounts: { perBlock: {}, total: 0 },
        processedActions: [],
        version: 1,
        schemaVersion: 1,
      },
      overrideAccess: true,
    })
  } catch (err: unknown) {
    if (!isDuplicateKeyError(err)) throw err
    // Duplicate key → another request created the session, proceed to re-read
  }

  // Step 6: Authoritative re-read — always return whatever is active now
  const active = await payload.find({
    collection: 'lesson-sessions',
    where: {
      user: { equals: user.id },
      lesson: { equals: lessonId },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })
  if (active.docs.length === 0) {
    throw new Error('Failed to create or find active session after reset')
  }
  return buildStepResponse(active.docs[0], lesson)
}
```

Helper:

```typescript
function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    return e.code === 11000 || (e.cause && (e.cause as Record<string, unknown>).code === 11000)
  }
  return false
}
```

### 3.3 Correctness Evaluator

**New file**: `src/server/payload/endpoints/interactive-demo/evaluate.ts`

> FIX #1: `evaluateMcq` simplified — single selected option vs single correct option.
> FIX #8: `evaluateOpen` returns `boolean` only — no `'ambiguous'` state, no LLM validation. Non-matching answers are treated as incorrect. Remediation still triggers for incorrect answers.
> FIX #13: `getOpenFeedback` / `getMcqFeedback` return deterministic UX messages. Open blocks use per-block `answerFormatHint` (if set) or a standard fallback message. The `feedback` string is included in `StepResponse` for the client to display.

```typescript
// Demo v1: single-select MCQ only
export function evaluateMcq(selectedOptionId: string, correctOptionId: string): boolean {
  return selectedOptionId === correctOptionId
}

// Demo v1: deterministic string matching only, no LLM validation (FIX #8)
export function evaluateOpen(answer: string, acceptedAnswers: string[]): boolean {
  const trimmed = answer.trim().toLowerCase()
  // Pass 1: normalized compare
  if (acceptedAnswers.some((a) => a.trim().toLowerCase() === trimmed)) return true
  // Pass 2: whitespace-removed compare
  const noSpace = trimmed.replace(/\s/g, '')
  if (acceptedAnswers.some((a) => a.trim().toLowerCase().replace(/\s/g, '') === noSpace))
    return true
  // No match → incorrect (remediation will still trigger if enabled)
  return false
}

// FIX #13: Deterministic feedback message for open answer evaluation
const DEFAULT_OPEN_INCORRECT_FEEDBACK = 'Not quite. Check your formatting and try again.'

export function getOpenFeedback(isCorrect: boolean, answerFormatHint?: string): string {
  if (isCorrect) return 'Correct!'
  return answerFormatHint ?? DEFAULT_OPEN_INCORRECT_FEEDBACK
}

export function getMcqFeedback(isCorrect: boolean): string {
  return isCorrect ? 'Correct!' : 'Not quite right.'
}
```

### 3.4 Remediation Service

**New file**: `src/server/payload/endpoints/interactive-demo/remediation.ts`

```typescript
export async function generateRemediation(params: {
  blockType: 'mcq' | 'open'
  prompt: string // question prompt text
  studentAnswer: string // what the student submitted
  remediationPrompt?: string // custom per-block prompt from lessonScript
  history: HistoryEntry[] // recent conversation context
}): Promise<string | null>
```

- Uses unified LLM adapter with `INTERACTIVE_REMEDIATION` model key
- System prompt: strict Socratic guidance, never reveal answer, delimit user input
- Clips user input to 2000 chars
- 10-second timeout
- Returns `null` on failure (no retries)

**Rate limiting** (checked in step-handler before calling):

- Max 3 per block (from `session.remediationCounts.perBlock[blockId]`)
- Max 15 per session (from `session.remediationCounts.total`)
- Stored on session document, not in memory

### 3.5 Block Sanitizer (strip answers for client)

**New file**: `src/server/payload/endpoints/interactive-demo/sanitize-block.ts`

```typescript
export function sanitizeBlockForClient(block: ScriptBlock): ClientBlock
```

- Content blocks: pass through
- MCQ blocks: strip `correctOptionIds`, strip `remediationPrompt`
- Open blocks: strip `acceptedAnswers`, strip `remediationPrompt`, strip `answerFormatHint`

### 3.6 Next.js API Route

**New file**: `src/app/api/lessons/step/route.ts`

Follow `src/app/api/exercises/validate-answer/route.ts` pattern:

```typescript
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return ApiErrors.unauthorized()

  const parsed = await parseAndValidate(request, StepRequestSchema)
  if ('error' in parsed) return parsed.error

  return handleStep(payload, user, parsed.data)
}
```

### 3.7 Centralized History Entry Builder (FIX #7)

**New file**: `src/server/payload/endpoints/interactive-demo/build-history-entry.ts`

> **FIX #7 — Centralized `buildHistoryEntry` helper** used everywhere history is appended.
> Prevents runtime write failures from missing required fields on the typed `history` array.
> **FIX #10 — Timestamp type**: Uses `new Date()` (not ISO string) for Payload `date` field compatibility. Payload serializes Date objects consistently; raw ISO strings may cause inconsistent storage depending on Payload version.

```typescript
import type { LessonSession } from '@/payload-types'

type HistoryRole = 'system' | 'user' | 'assistant'
type HistoryBlockType = 'content' | 'mcq' | 'open' | 'remediation'

interface BuildHistoryEntryParams {
  role: HistoryRole
  blockType: HistoryBlockType
  content: string
  metadata?: Record<string, unknown> // { blockIndex, isCorrect?, selectedOptionIds?, normalizedAnswer?, scoreDelta? }
}

type HistoryEntry = NonNullable<LessonSession['history']>[number]

/**
 * Factory for history entries. Enforces all required fields so Payload
 * array validation never rejects a history append at runtime.
 */
export function buildHistoryEntry(params: BuildHistoryEntryParams): HistoryEntry {
  return {
    role: params.role,
    blockType: params.blockType,
    content: params.content,
    timestamp: new Date(), // FIX #10: Date object for Payload date field compatibility
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
  }
}
```

**Usage in step-handler.ts** — all history appends go through this helper:

```typescript
import { buildHistoryEntry } from './build-history-entry'

// Example: system delivers a content block
session.history.push(
  buildHistoryEntry({
    role: 'system',
    blockType: 'content',
    content: block.content.value,
    metadata: { blockIndex: session.currentBlockIndex },
  }),
)

// Example: user submits an MCQ answer
session.history.push(
  buildHistoryEntry({
    role: 'user',
    blockType: 'mcq',
    content: selectedOptionId,
    metadata: { blockIndex: session.currentBlockIndex, selectedOptionIds: [selectedOptionId] },
  }),
)

// Example: system evaluates answer
session.history.push(
  buildHistoryEntry({
    role: 'assistant',
    blockType: 'mcq',
    content: isCorrect ? 'correct' : 'incorrect',
    metadata: { blockIndex: session.currentBlockIndex, isCorrect, scoreDelta: isCorrect ? 1 : 0 },
  }),
)

// Example: remediation response
session.history.push(
  buildHistoryEntry({
    role: 'assistant',
    blockType: 'remediation',
    content: remediationText,
    metadata: { blockIndex: session.currentBlockIndex },
  }),
)
```

---

## Phase 4: Rendering Branch in Lesson Page

### 4.1 Insert Branch in Lesson Page

**File**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`

**Insertion point**: After line 50 (after chapter/course validation), before line 53 (`chatLessonId`).

```typescript
// Interactive Demo: additive code path gated by lesson.type === 'interactive_demo'
if (lesson.type === 'interactive_demo') {
  const { InteractiveDemoGate } = await import('@/ui/web/interactive-demo/InteractiveDemoGate')
  return (
    <>
      <LessonAnalytics lessonId={lesson.id} courseId={course.id} lessonTitle={lesson.title} />
      <InteractiveDemoGate
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        backUrl={backUrl}
        typewriterEnabled={lesson.typewriterEnabled ?? true}
      />
    </>
  )
}
```

Uses dynamic import to keep the interactive demo code tree-shaken from existing flows. No behavioral changes to existing PDF/exercise/chat lesson paths.

### 4.2 Feature Gate Component (Server)

**New file**: `src/ui/web/interactive-demo/InteractiveDemoGate.tsx`

Server component that:

1. Checks feature flag via `getInteractiveDemoConfig()`
2. If disabled → renders "Coming Soon" state
3. If enabled → renders `<InteractiveDemoView />`

---

## Phase 5: Frontend UI Components

### 5.1 Directory Structure

```
src/ui/web/interactive-demo/
├── InteractiveDemoGate.tsx        (server component — feature gate)
├── InteractiveDemoView.tsx        (client component — main orchestrator)
├── hooks/
│   └── useInteractiveSession.ts   (client-side session state + API calls)
├── components/
│   ├── BlockStream.tsx            (scrollable block list)
│   ├── BlockReveal.tsx            (typewriter reveal wrapper)
│   ├── ContentBlock.tsx           (renders content blocks)
│   ├── McqBlock.tsx               (MCQ question — radio buttons only)
│   ├── OpenBlock.tsx              (open-response input)
│   ├── AnswerDock.tsx             (fixed answer submission area)
│   ├── RemediationBubble.tsx      (AI remediation display)
│   ├── ContinueButton.tsx         (explicit progression button)
│   └── SessionControls.tsx        (reset/resume controls)
└── types.ts                       (client-side types)
```

### 5.2 `useInteractiveSession` Hook

**New file**: `src/ui/web/interactive-demo/hooks/useInteractiveSession.ts`

> **FIX #2**: `reset()` action is a first-class operation.
> **FIX #3**: State tracks `currentPhase` from server.

```typescript
interface SessionState {
  sessionId: string | null
  status: 'idle' | 'loading' | 'active' | 'completed' | 'error'
  currentBlockIndex: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' | null // FIX #3
  blocks: ClientBlock[] // blocks revealed so far
  skillScore: number
  remediation: string | null
  isSubmitting: boolean
}
```

Actions:

- `start()` → POST `/api/lessons/step` with `action: 'start'`
- `submitAnswer(answer | selectedOptionId)` → POST with `action: 'answer'`
- `next()` → POST with `action: 'next'`
- `reset()` → POST with `action: 'reset'` (FIX #2: deterministic restart)

Each action generates a `clientActionId` via `crypto.randomUUID()`.

**Phase-driven UI gating:**

- `currentPhase === 'awaiting_input'` → show AnswerDock, hide ContinueButton
- `currentPhase === 'awaiting_continue'` → show ContinueButton, hide AnswerDock

### 5.3 `InteractiveDemoView` (Client Component)

**New file**: `src/ui/web/interactive-demo/InteractiveDemoView.tsx`

Layout:

- Header bar with lesson title + back button (reuse `BackToChapter` pattern)
- Main area: `<BlockStream>` (scrollable, grows downward)
- Bottom dock: `<AnswerDock>` (appears only when `currentPhase === 'awaiting_input'`)
- `<ContinueButton>` appears only when `currentPhase === 'awaiting_continue'`
- Skill score indicator (small badge)
- Reset button in `<SessionControls>`

On mount → calls `start()` → renders first block.

### 5.4 Block Components

**`ContentBlock.tsx`**: Renders `MathMarkdown` with the block's rich text content. Reuses existing `MathMarkdown` from `src/ui/web/shared/MathMarkdown/index.tsx`.

> **FIX #1**: `McqBlock.tsx` renders as **radio buttons only** (single-select). No checkbox mode. Comment: "Demo v1 MCQ is single-select only; multi-select is future."

**`McqBlock.tsx`**: Renders prompt via `MathMarkdown`, options as radio buttons. Does NOT reuse `McqQuestion` from exercise renderer (exercise-specific logic). Simple, isolated:

- Always radio buttons (single-select)
- Selected option stored as single string, not array
- Disabled state after submission

**`OpenBlock.tsx`**: Renders prompt via `MathMarkdown`, text input field.

**`AnswerDock.tsx`**: Fixed bottom bar with Submit button. Receives current answer state from parent. Shows loading state during submission. Only visible when `currentPhase === 'awaiting_input'`.

**`BlockReveal.tsx`**: Wraps each block with a CSS animation for block-level reveal (fade-in + slide-up). If `typewriterEnabled` is false, renders immediately. Includes "Skip" button to fast-forward animation.

**`RemediationBubble.tsx`**: Renders AI remediation text via `MathMarkdown` in a distinct visual style (e.g., info card with AI icon).

**`ContinueButton.tsx`**: Only visible when `currentPhase === 'awaiting_continue'`. Calls `next()` on the session hook.

**`SessionControls.tsx`**: Reset button that calls `reset()`. Shows confirmation dialog before reset.

### 5.5 Translations

**Files**: `messages/en.json` and `messages/he.json`

Add namespace `interactiveDemo`:

```json
{
  "interactiveDemo": {
    "continue": "Continue",
    "submit": "Submit Answer",
    "correct": "Correct!",
    "incorrect": "Not quite right.",
    "incorrectOpenDefault": "Not quite. Check your formatting and try again.",
    "comingSoon": "This lesson type is coming soon",
    "completed": "Lesson Complete!",
    "reset": "Start Over",
    "resetConfirm": "Are you sure? This will restart the lesson from the beginning.",
    "score": "Score",
    "typeAnswer": "Type your answer...",
    "loading": "Loading lesson...",
    "selectOption": "Select an answer"
  }
}
```

### 5.6 Scoped Styles

All styles use Tailwind classes scoped to the `interactive-demo` component tree. No global CSS modifications. No reuse of chat message wrappers.

---

## Implementation Order (Recommended)

| Step | Description                                                                                                                             | Dependencies     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1    | Phase 0: Constants, types, feature flag, error codes, model key                                                                         | None             |
| 2    | Phase 1.1-1.2: Lesson collection fields + script schema (FIX #1: MCQ single-select)                                                     | Step 1           |
| 3    | Phase 1.3-1.4: Validation hooks incl. active session guard (FIX #4) + type generation                                                   | Step 2           |
| 4    | Phase 2: LessonSessions collection (FIX #3, #5, #9, #11: currentPhase, typed history, hard limits, processedActions) + index + type gen | Step 1           |
| 5    | Phase 3.1-3.3: Request schemas + evaluator (FIX #1, #2, #3, #8, #11, #13)                                                               | Step 1           |
| 6    | Phase 3.4 + 3.7: Remediation service + buildHistoryEntry helper (FIX #7, #10)                                                           | Step 5           |
| 7    | Phase 3.2, 3.5: Step handler + sanitizer (FIX #2, #3, #6, #7, #11, #12, #13)                                                            | Steps 3, 4, 5, 6 |
| 8    | Phase 3.6: API route                                                                                                                    | Step 7           |
| 9    | Phase 5.2: useInteractiveSession hook (FIX #2: reset, FIX #3: phase)                                                                    | Step 8           |
| 10   | Phase 5.3-5.4: UI components (FIX #1: radio only)                                                                                       | Step 9           |
| 11   | Phase 4: Lesson page branch + gate                                                                                                      | Step 10          |
| 12   | Phase 5.5: Translations                                                                                                                 | Step 10          |

Steps 2-4 can run in parallel. Steps 5-6 can run in parallel with 3-4.

---

## Files Created (New)

| #   | File                                                                   | Purpose                                                                |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `src/server/config/interactive-demo-config.ts`                         | Feature flag accessor                                                  |
| 2   | `src/server/payload/collections/Lessons/interactive-demo-schema.ts`    | LessonScript Zod schema (FIX #1: single-select MCQ)                    |
| 3   | `src/server/payload/collections/LessonSessions.ts`                     | Session collection (FIX #3: currentPhase, FIX #5: typed history array) |
| 4   | `src/server/payload/migrations/createLessonSessionIndex.ts`            | Unique active session index                                            |
| 5   | `src/server/payload/endpoints/interactive-demo/schemas.ts`             | API request/response schemas (FIX #2: reset, FIX #3: phase)            |
| 6   | `src/server/payload/endpoints/interactive-demo/step-handler.ts`        | Core state machine (FIX #2: reset, FIX #3: phase transitions)          |
| 7   | `src/server/payload/endpoints/interactive-demo/evaluate.ts`            | Answer correctness evaluation (FIX #1: single-select MCQ)              |
| 8   | `src/server/payload/endpoints/interactive-demo/remediation.ts`         | LLM remediation service                                                |
| 9   | `src/server/payload/endpoints/interactive-demo/sanitize-block.ts`      | Strip answers for client                                               |
| 10  | `src/server/payload/endpoints/interactive-demo/build-history-entry.ts` | Centralized history entry factory (FIX #7)                             |
| 11  | `src/app/api/lessons/step/route.ts`                                    | Next.js API route wrapper                                              |
| 12  | `src/ui/web/interactive-demo/InteractiveDemoGate.tsx`                  | Server feature gate                                                    |
| 13  | `src/ui/web/interactive-demo/InteractiveDemoView.tsx`                  | Main client orchestrator                                               |
| 14  | `src/ui/web/interactive-demo/hooks/useInteractiveSession.ts`           | Client session hook (FIX #2: reset, FIX #3: phase)                     |
| 15  | `src/ui/web/interactive-demo/components/BlockStream.tsx`               | Block list                                                             |
| 16  | `src/ui/web/interactive-demo/components/BlockReveal.tsx`               | Reveal animation                                                       |
| 17  | `src/ui/web/interactive-demo/components/ContentBlock.tsx`              | Content renderer                                                       |
| 18  | `src/ui/web/interactive-demo/components/McqBlock.tsx`                  | MCQ renderer (FIX #1: radio only)                                      |
| 19  | `src/ui/web/interactive-demo/components/OpenBlock.tsx`                 | Open response renderer                                                 |
| 20  | `src/ui/web/interactive-demo/components/AnswerDock.tsx`                | Answer submission dock                                                 |
| 21  | `src/ui/web/interactive-demo/components/RemediationBubble.tsx`         | AI feedback display                                                    |
| 22  | `src/ui/web/interactive-demo/components/ContinueButton.tsx`            | Progression button                                                     |
| 23  | `src/ui/web/interactive-demo/components/SessionControls.tsx`           | Reset/resume controls                                                  |
| 24  | `src/ui/web/interactive-demo/types.ts`                                 | Client-side types                                                      |

## Files Modified (Existing)

| #   | File                                                   | Change                                                                          |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | `src/server/constants/lesson-types.ts`                 | Add `'interactive_demo'` to array                                               |
| 2   | `src/infra/config/config-constants.ts`                 | Add `InteractiveDemo` to `ConfigDomain`                                         |
| 3   | `src/server/api/responses.ts`                          | Add 6 new error codes to union                                                  |
| 4   | `src/infra/llm/models.ts`                              | Add `INTERACTIVE_REMEDIATION` model key                                         |
| 5   | `src/server/payload/collections/Lessons.ts`            | Add interactive_demo option + 4 fields + 2 hooks (FIX #4: active session guard) |
| 6   | `src/payload.config.ts`                                | Register `LessonSessions` collection + index migration                          |
| 7   | `src/app/(frontend)/.../lessons/[lessonSlug]/page.tsx` | Add `interactive_demo` branch (5 lines)                                         |
| 8   | `messages/en.json`                                     | Add `interactiveDemo` namespace                                                 |
| 9   | `messages/he.json`                                     | Add `interactiveDemo` namespace                                                 |
| 10  | `src/payload-types.ts`                                 | Auto-regenerated                                                                |

## Reused Existing Code

| What                                       | From                                                | Used In                                                             |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------- |
| `MathMarkdown`                             | `src/ui/web/shared/MathMarkdown/index.tsx`          | All block components                                                |
| `InlineRichText` type                      | `src/shared/exercise-content/types.ts`              | Schema + types (pattern only, defined separately to avoid coupling) |
| `tenantField`                              | `src/server/payload/fields/tenant.ts`               | LessonSessions collection                                           |
| `authenticatedOrOwner`                     | `src/server/payload/access/authenticatedOrOwner.ts` | LessonSessions access control                                       |
| `authenticated`                            | `src/server/payload/access/authenticated.ts`        | LessonSessions create access                                        |
| `adminOnly`                                | `src/server/payload/access/adminOnly.ts`            | LessonSessions delete access                                        |
| `apiError`/`apiSuccess`/`parseAndValidate` | `src/server/api/responses.ts`                       | Step API route                                                      |
| `getConfigDomain`                          | `src/infra/config/runtime/config-values.ts`         | Feature flag accessor                                               |
| Unified LLM adapter                        | `src/infra/llm/genkit/adapters/unified-adapter.ts`  | Remediation service                                                 |
| `BackToChapter`                            | `src/app/(frontend)/.../BackToChapter`              | InteractiveDemoView header                                          |
| `LessonAnalytics`                          | Lesson page `_components/LessonAnalytics`           | Lesson page branch                                                  |

---

## Fix Summary (Cross-Reference)

| Fix                                    | What Changed                                                                                                                                                                               | Where                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **#1 MCQ single-select**               | `correctOptionIds.length(1)` in schema; `evaluateMcq` takes single ID; `McqBlock.tsx` renders radio only                                                                                   | Schema (1.2), Evaluator (3.3), McqBlock (5.4)                                 |
| **#2 Reset is must-have**              | `action: 'reset'` in StepRequestSchema; deterministic reset handler; `reset()` in client hook                                                                                              | Schemas (3.1), Step handler (3.2), Hook (5.2), SessionControls (5.4)          |
| **#3 Explicit session phase**          | `currentPhase` field on LessonSessions; phase-gated transitions in step handler; phase in API response; UI gated by phase                                                                  | Collection (2.1), Schemas (3.1), Step handler (3.2), Hook (5.2), UI (5.3-5.4) |
| **#4 Block script edits**              | `beforeChange` hook on Lessons checks for active sessions before allowing lessonScript modification                                                                                        | Lessons hooks (1.3)                                                           |
| **#5 History shape + cap**             | `history` as typed `array` field with `maxRows: 200` and defined subfields                                                                                                                 | Collection (2.1)                                                              |
| **#6 Reset concurrency collision**     | Wrap session creation in try/catch; detect duplicate key error (code 11000); fallback to re-query active session for idempotent-ish behavior                                               | Step handler (3.2)                                                            |
| **#7 Centralized `buildHistoryEntry`** | Factory helper enforces required fields (`role`, `blockType`, `content`, `timestamp`); used everywhere history is appended                                                                 | New file (3.7), Step handler (3.2)                                            |
| **#8 Ambiguous = incorrect**           | `evaluateOpen` returns `boolean` only (no `'ambiguous'` state); non-matching answers treated as incorrect; no LLM validation in Demo v1                                                    | Evaluator (3.3), Step handler (3.2)                                           |
| **#9 History hard limits**             | `content` field gets `maxLength: 5000`; `timestamp` uses Payload `date` type with consistent `new Date()` writes                                                                           | Collection (2.1)                                                              |
| **#10 Timestamp type**                 | `buildHistoryEntry` uses `new Date()` (not ISO string) for Payload date field compatibility                                                                                                | buildHistoryEntry (3.7)                                                       |
| **#11 Idempotent result cache**        | `processedActions` typed array (max 50) replaces `processedActionIds`; each entry stores `{ actionId, createdAt, response }` — duplicate `clientActionId` returns cached response verbatim | Collection (2.1), Schemas (3.1), Step handler (3.2)                           |
| **#12 Reset authoritative re-read**    | Reset always ends with `re-find active session` instead of trusting create result; conditional update for old session; duplicate key errors ignored gracefully                             | Step handler (3.2)                                                            |
| **#13 Deterministic UX feedback**      | `feedback` + `isCorrect` fields in `StepResponse`; `getOpenFeedback(isCorrect, answerFormatHint?)` with per-block hint or standard fallback; `getMcqFeedback(isCorrect)`                   | Evaluator (3.3), Schemas (3.1), Schema (1.2), Translations (5.5)              |
| **#14 Feature flag enablement docs**   | Documented config-values setup: domain=`interactive_demo`, key=`enabled`, value=`true`; admin panel + API instructions                                                                     | Config (0.3)                                                                  |

---

## Verification Plan

### Unit Tests

- `interactive-demo-schema.test.ts`:
  - Valid lessonScript passes
  - MCQ with multiple correctOptionIds fails (FIX #1)
  - MCQ with exactly 1 correctOptionId passes
  - Boundary values: 50 blocks, 5000 char content, 6 options
  - Duplicate block IDs rejected
- `evaluate.test.ts`:
  - MCQ single-option comparison (FIX #1)
  - Open normalized matching, whitespace-removed
  - Open non-matching answer returns `false` (FIX #8: no ambiguous state)
  - Open return type is `boolean` only, never `'ambiguous'` (FIX #8)
  - `getOpenFeedback` returns `answerFormatHint` when set, fallback when not (FIX #13)
  - `getMcqFeedback` returns deterministic correct/incorrect strings (FIX #13)
- `step-handler.test.ts`:
  - Phase transitions: `answer` rejected when `awaiting_continue` (FIX #3)
  - Phase transitions: `next` rejected when `awaiting_input` (FIX #3)
  - Reset creates new session, old marked completed (FIX #2)
  - Reset with no existing session creates fresh session (FIX #2)
  - Idempotency: duplicate clientActionId returns **identical cached response** including feedback/remediation (FIX #11)
  - Idempotency: processedActions capped at 50 entries FIFO (FIX #11)
  - Optimistic lock conflict handling
  - Reset concurrency: duplicate key error returns existing session via authoritative re-read (FIX #6, #12)
  - Reset: always returns re-read active session, not create result (FIX #12)
  - Rate limit logic
- `build-history-entry.test.ts`:
  - Required fields (`role`, `blockType`, `content`, `timestamp`) are always present (FIX #7)
  - `timestamp` is auto-set to `new Date()` (FIX #7, #10)
  - Optional `metadata` attached when provided (FIX #7)
  - Missing required fields cause TypeScript compile error (FIX #7)
- `sanitize-block.test.ts`: Answers stripped correctly
- `lesson-script-guard.test.ts`:
  - Edit blocked when active sessions exist (FIX #4)
  - Edit allowed when no active sessions
  - Edit allowed when only completed sessions
- `history-cap.test.ts`:
  - History never exceeds 200 entries (FIX #5)
  - History `content` field rejects values > 5000 chars (FIX #9)
  - History entries have required fields

### Integration Tests

- API auth: unauthenticated → 401, wrong user → 403
- Single active session enforcement
- Feature flag disabled → `FEATURE_DISABLED` error
- Full flow: start → answer (correct) → next → answer (incorrect + remediation) → next → complete
- Reset flow: start → answer → reset → verify fresh session (via authoritative re-read)
- Concurrent reset: two simultaneous resets → both return valid active session, no raw DB error (FIX #6, #12)
- Idempotent retry: submit answer → retry same clientActionId → get identical response with same feedback/remediation (FIX #11)
- Open answer: non-matching answer marked incorrect with deterministic feedback message (FIX #8, #13)
- Open answer with `answerFormatHint`: feedback uses custom hint (FIX #13)
- Feature flag: verify `config-values` enablement path works (FIX #14)
- Existing PDF lesson rendering unchanged (regression)

### Commands

```bash
pnpm generate:types                    # After schema changes
pnpm typecheck                         # Type verification
pnpm lint                              # Lint check
pnpm test:int                          # Integration tests
pnpm dev                               # Manual testing at localhost:3000
```
