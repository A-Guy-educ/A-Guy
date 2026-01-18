# Task: Move Lesson System Prompt to Payload Prompts (TDD)

## Goal

Replace the hardcoded/markdown-based system prompt source with a **Payload `Prompts` collection**, starting **only at the Lesson level**, while keeping the chat endpoint behavior stable. Implement via **TDD** and update/fix any existing tests impacted by the change.

---

## Scope

### In

- Create a new Payload collection: **`prompts`**.
- Add a **relationship field** on **`lessons`**: `prompt` → `prompts` (single).
- Update `src/endpoints/agent/chat.ts` to load the Lesson's prompt template from Payload and use it as `systemInstructions`.
- **Exercise chats inherit parent Lesson's prompt** (read-only, no override on Exercise).
- Keep existing context policy flow: lesson context injection → `composePrompt` → Gemini call.
- Remove the legacy markdown prompt dependency from `src/lib/ai/services/exercise-chat-service.ts`.
- Update / fix existing tests for all touched modules.

### Out (for this task)

- No prompt placeholders / inputVars system.
- No prompt overrides on exercises/chapters/courses yet.
- No prompt bundles/policies collection.
- No admin UX improvements beyond basic relationship selection.

---

## Success Criteria

- Chat endpoint uses **Prompt from Lesson relationship** when available.
- If Lesson has **no prompt** or the linked prompt is **not `published`**, endpoint uses a **deterministic fallback** (defined below) without crashing.
- Existing chat behavior remains stable (no duplicated user message, no missing system message).
- All tests pass (new + updated).

---

## Design Decisions (Locked)

- Relationship from Lesson → Prompt (single).
- Prompts use status: `draft | published | archived`.
- Runtime uses **published only**.
- Both inputs are included:
  - **Lesson Prompt template** is the base system instructions.
  - **`lessonContextText`** (if present) is injected into the system instructions via `buildLessonContextPrompt` **before** `composePrompt`.
- Fallback order for system prompt:
  1. Lesson.prompt (if exists and is `published`)
  2. Global default prompt (first published prompt with `isDefaultForAgentChat=true`)
  3. Minimal built-in fallback string (last resort; logs warning)

---

## Data Model

### 1) `prompts` collection

**Fields**

- `title` (text, required, indexed)
- `key` (text, unique, indexed, optional) - machine-readable identifier
- `status` (select: `draft|published|archived`, required, default `draft`, indexed)
- `template` (textarea, required) - the actual prompt content
- `isDefaultForAgentChat` (checkbox, default false, indexed)
- `updatedAt/createdAt` (Payload timestamps)

**Access**

- Read: **adminOnly** (endpoint uses `overrideAccess: true` for prompt fetches only)
- Write: adminOnly

**Indexes**

- index on `status`
- index on `isDefaultForAgentChat`
- unique index on `key`

### 2) `lessons` changes

- Add `prompt` field: relationship → `prompts` (single, optional, indexed)

---

## Architecture: Secure Fetch Pattern

### Problem with naive single-fetch

If we fetch Lesson with `depth:1` and `overrideAccess:true` just to populate the prompt relationship, we bypass Lesson access rules and potentially leak restricted lesson data.

### Solution: Two-fetch pattern (secure)

1. **Fetch Lesson** with normal access checks (`overrideAccess: false`, `depth: 0`)
   - Gets `lessonContextText` and `prompt` (as ID string if set)
2. **Fetch Prompt separately** with `overrideAccess: true` (only if lesson has prompt ID)
   - Safe because Prompts collection is admin-only by design
3. **Query default prompt** with `overrideAccess: true` (if lesson prompt not available)

```
Step 9a: Fetch lesson (overrideAccess: false, depth: 0) → get lessonContextText + promptId
Step 9b: If promptId exists → fetch prompt (overrideAccess: true)
Step 10: resolveAgentSystemPrompt(prompt object or null) → may query default
```

This preserves Lesson access control while allowing server-side access to admin-only Prompts.

---

## Implementation Stages (TDD-first)

## Stage 0 — Baseline & Safety Rails

**Timebox:** 30–60 minutes

**Deliverables**

- Identify current tests that cover `agent/chat.ts` and `exercise-chat-service.ts`.
- Verify existing test at `tests/int/agent-chat.int.spec.ts` mocks `getSystemPrompt()`.
- Create test skeleton: `tests/unit/lib/ai/prompt-resolver.spec.ts`

**Guardrails**

- No behavior changes yet.
- No refactors beyond what's needed to test.

---

## Stage 1 — Add Prompts Collection + Lesson Relationship (Schema)

**Timebox:** 60–120 minutes

### 1.1 Create `src/collections/Prompts.ts`

```typescript
import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access/adminOnly'

export const Prompts: CollectionConfig = {
  slug: 'prompts',
  access: {
    create: adminOnly,
    read: adminOnly, // Endpoint uses overrideAccess: true for prompt fetches
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'key', 'status', 'isDefaultForAgentChat', 'updatedAt'],
    group: 'AI',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Human-readable prompt name' },
    },
    {
      name: 'key',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Machine-readable key (e.g., "default-tutor-v1")',
        position: 'sidebar',
      },
    },
    {
      name: 'template',
      type: 'textarea',
      required: true,
      admin: {
        description: 'System prompt template for AI tutor',
        rows: 20,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      index: true,
      admin: { description: 'Only "published" prompts are used at runtime' },
    },
    {
      name: 'isDefaultForAgentChat',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Use as fallback when lesson has no prompt',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
  // NOTE: No hook to enforce single default - query limit:1 and warn if multiple
}
```

### 1.2 Update `src/collections/Lessons.ts`

Add after `lessonContextText` field (~line 121):

```typescript
{
  name: 'prompt',
  type: 'relationship',
  relationTo: 'prompts',
  index: true,
  admin: {
    position: 'sidebar',
    description: 'AI system prompt for this lesson (uses default if not set)',
  },
},
```

### 1.3 Update `src/payload.config.ts`

Add import:

```typescript
import { Prompts } from './collections/Prompts'
```

Add to collections array:

```typescript
collections: [
  // ... existing
  Prompts,
],
```

### 1.4 Generate Types

```bash
pnpm generate:types
```

**TDD Tests**

- `prompts` can be created with `title/status/template`.
- `lessons.prompt` accepts a valid prompt relationship.
- Access control: non-admin cannot read prompts directly.

**Acceptance Checks**

- Payload boots with the new collection.
- Relationship resolves at depth 0/1 without issues.
- Admin UI shows Prompts collection and Lesson.prompt field.

---

## Stage 2 — Prompt Selection Logic (Resolver)

**Timebox:** 2–4 hours

### 2.1 Create `src/lib/ai/prompt-resolver.server.ts`

```typescript
/**
 * Resolves system prompt for AI tutor
 *
 * Priority:
 * 1. Lesson.prompt (if provided and published)
 * 2. Default prompt (first published with isDefaultForAgentChat=true)
 * 3. Built-in fallback (logs warning)
 *
 * @param payload - Payload instance (for querying default prompt)
 * @param lessonPrompt - Pre-loaded prompt object (fetched separately with overrideAccess)
 */
import type { Payload } from 'payload'
import type { Prompt } from '@/payload-types'
import { logger } from '@/utilities/logger'

// Local constant - no cross-module imports to avoid circular deps
export const BUILTIN_FALLBACK_PROMPT = `You are a helpful math and science tutor for students working on exercises.

Guide students through problem-solving without giving direct answers.
Ask clarifying questions to help them think critically.
Be supportive and patient.`

export type PromptResolutionResult = {
  template: string
  resolvedFrom: 'lesson-prompt' | 'default-prompt' | 'fallback'
  promptId?: string
  promptTitle?: string
  fallbackReason?: string
}

/**
 * Resolve system prompt from pre-loaded lesson prompt or fallback to default
 *
 * Deterministic behavior for input types:
 * - Prompt object with status='published' → use it
 * - Prompt object with status!='published' → fall back to default
 * - null/undefined → fall back to default
 *
 * Note: If caller has only a prompt ID (string), they must fetch the prompt
 * object first before calling this function.
 */
export async function resolveAgentSystemPrompt(
  payload: Payload,
  lessonPrompt: Prompt | null | undefined,
): Promise<PromptResolutionResult> {
  // 1) Check if lesson has a populated prompt object
  if (lessonPrompt && typeof lessonPrompt === 'object') {
    if (lessonPrompt.status === 'published') {
      return {
        template: lessonPrompt.template,
        resolvedFrom: 'lesson-prompt',
        promptId: lessonPrompt.id,
        promptTitle: lessonPrompt.title,
      }
    }
    // Prompt exists but not published
    logger.debug(
      { promptId: lessonPrompt.id, status: lessonPrompt.status },
      'Lesson prompt not published, falling back',
    )
  }

  // 2) Query for default prompt (with overrideAccess since prompts are admin-only)
  try {
    const defaultPrompts = await payload.find({
      collection: 'prompts',
      where: {
        and: [{ isDefaultForAgentChat: { equals: true } }, { status: { equals: 'published' } }],
      },
      limit: 1,
      overrideAccess: true,
    })

    // Warn if multiple defaults exist (query totalDocs)
    if (defaultPrompts.totalDocs > 1) {
      logger.warn(
        { count: defaultPrompts.totalDocs },
        'Multiple published default prompts found, using first one',
      )
    }

    if (defaultPrompts.docs.length > 0) {
      const defaultPrompt = defaultPrompts.docs[0]
      return {
        template: defaultPrompt.template,
        resolvedFrom: 'default-prompt',
        promptId: defaultPrompt.id,
        promptTitle: defaultPrompt.title,
        fallbackReason: lessonPrompt ? 'Lesson prompt not published' : 'Lesson has no prompt',
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to query default prompt')
  }

  // 3) Built-in fallback
  logger.warn('No published prompts available, using built-in fallback')
  return {
    template: BUILTIN_FALLBACK_PROMPT,
    resolvedFrom: 'fallback',
    fallbackReason: 'No published prompts in database',
  }
}
```

### 2.2 Create `tests/unit/lib/ai/prompt-resolver.spec.ts`

**TDD: Required test cases**

1. **Lesson has published prompt** → returns its `template`, no DB query for default
2. **Lesson has draft prompt** → falls back to default
3. **Lesson has archived prompt** → falls back to default
4. **Lesson has no prompt (null)** → queries and uses default
5. **Lesson prompt is undefined** → queries and uses default
6. **Multiple defaults exist** → uses first, logs warning
7. **No published default exists** → returns built-in fallback, logs warning
8. **Database error on default query** → returns built-in fallback gracefully

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveAgentSystemPrompt, BUILTIN_FALLBACK_PROMPT } from '@/lib/ai/prompt-resolver.server'
import { logger } from '@/utilities/logger'

// Mock logger
vi.mock('@/utilities/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockPayload = {
  find: vi.fn(),
}

describe('resolveAgentSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when lessonPrompt is a published prompt object', () => {
    it('returns lesson prompt without querying database', async () => {
      const lessonPrompt = {
        id: 'prompt-1',
        title: 'Math Tutor',
        template: 'You are a math tutor.',
        status: 'published' as const,
        isDefaultForAgentChat: false,
        createdAt: '',
        updatedAt: '',
      }

      const result = await resolveAgentSystemPrompt(mockPayload as any, lessonPrompt)

      expect(result.template).toBe('You are a math tutor.')
      expect(result.resolvedFrom).toBe('lesson-prompt')
      expect(result.promptId).toBe('prompt-1')
      expect(mockPayload.find).not.toHaveBeenCalled()
    })
  })

  describe('when lessonPrompt is draft', () => {
    it('falls back to default prompt', async () => {
      const draftPrompt = {
        id: 'p-2',
        title: 'Draft',
        template: 'Draft.',
        status: 'draft' as const,
        isDefaultForAgentChat: false,
        createdAt: '',
        updatedAt: '',
      }
      mockPayload.find.mockResolvedValue({
        docs: [
          {
            id: 'default-1',
            title: 'Default',
            template: 'Default template.',
            status: 'published',
          },
        ],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, draftPrompt)

      expect(result.resolvedFrom).toBe('default-prompt')
      expect(result.fallbackReason).toBe('Lesson prompt not published')
      expect(logger.debug).toHaveBeenCalled()
    })
  })

  describe('when lessonPrompt is archived', () => {
    it('falls back to default prompt', async () => {
      const archivedPrompt = {
        id: 'p-3',
        title: 'Archived',
        template: 'Archived.',
        status: 'archived' as const,
        isDefaultForAgentChat: false,
        createdAt: '',
        updatedAt: '',
      }
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'default-1', template: 'Default.', status: 'published' }],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, archivedPrompt)

      expect(result.resolvedFrom).toBe('default-prompt')
    })
  })

  describe('when lessonPrompt is null', () => {
    it('uses default prompt', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'default-1', title: 'Default', template: 'Default.', status: 'published' }],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.resolvedFrom).toBe('default-prompt')
      expect(result.fallbackReason).toBe('Lesson has no prompt')
    })
  })

  describe('when lessonPrompt is undefined', () => {
    it('uses default prompt', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'default-1', template: 'Default.', status: 'published' }],
        totalDocs: 1,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, undefined)

      expect(result.resolvedFrom).toBe('default-prompt')
    })
  })

  describe('multiple defaults warning', () => {
    it('logs warning when multiple defaults exist and uses first', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ id: 'default-1', title: 'First', template: 'First.', status: 'published' }],
        totalDocs: 3,
      })

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.resolvedFrom).toBe('default-prompt')
      expect(result.promptId).toBe('default-1')
      expect(logger.warn).toHaveBeenCalledWith(
        { count: 3 },
        'Multiple published default prompts found, using first one',
      )
    })
  })

  describe('fallback behavior', () => {
    it('returns built-in fallback when no prompts exist', async () => {
      mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.template).toBe(BUILTIN_FALLBACK_PROMPT)
      expect(result.resolvedFrom).toBe('fallback')
      expect(result.fallbackReason).toBe('No published prompts in database')
      expect(logger.warn).toHaveBeenCalledWith(
        'No published prompts available, using built-in fallback',
      )
    })

    it('returns built-in fallback on database error', async () => {
      mockPayload.find.mockRejectedValue(new Error('DB connection failed'))

      const result = await resolveAgentSystemPrompt(mockPayload as any, null)

      expect(result.resolvedFrom).toBe('fallback')
      expect(logger.error).toHaveBeenCalled()
    })
  })
})
```

---

## Stage 3 — Update Chat Endpoint

**Timebox:** 1–2 hours

### 3.1 Update `src/endpoints/agent/chat.ts`

**Update imports (line 30):**

```typescript
// REMOVE: import { chatWithExerciseHelper, getSystemPrompt } from '@/lib/ai/services/exercise-chat-service'
// ADD:
import { chatWithExerciseHelper } from '@/lib/ai/services/exercise-chat-service'
import { resolveAgentSystemPrompt } from '@/lib/ai/prompt-resolver.server'
```

**Add type import at top:**

```typescript
import type { Prompt } from '@/payload-types'
```

**Replace Steps 9-10 (lines 258-294) with secure fetch pattern:**

```typescript
// 9) Fetch lesson context and prompt using secure fetch pattern
//
// We use a two-fetch pattern for security:
// - Lesson fetched with normal access checks (overrideAccess: false)
// - Prompt fetched separately with overrideAccess: true (admin-only collection)
// This preserves Lesson access control while allowing server access to Prompts.

let lessonContextText: string | undefined
let lessonPrompt: Prompt | null = null

if (context.relationTo === 'lessons') {
  // Direct lesson context - fetch with access checks
  const lesson = await req.payload.findByID({
    collection: 'lessons',
    id: context.value,
    depth: 0,
    user: req.user, // Pass user for access control
    // DO NOT use overrideAccess here - preserve lesson access control
  })
  lessonContextText = lesson.lessonContextText ?? undefined

  // Fetch prompt separately if lesson has one (admin-only, requires override)
  if (lesson.prompt) {
    const promptId = typeof lesson.prompt === 'string' ? lesson.prompt : lesson.prompt.id
    try {
      lessonPrompt = await req.payload.findByID({
        collection: 'prompts',
        id: promptId,
        overrideAccess: true, // Prompts are admin-only
      })
    } catch (error) {
      reqLogger.warn(
        { err: error, promptId, lessonId: context.value },
        'Failed to fetch lesson prompt',
      )
      // Continue with null - will fall back to default
    }
  }
} else if (context.relationTo === 'exercises') {
  // Exercise context - inherit parent lesson's prompt
  const exercise = await req.payload.findByID({
    collection: 'exercises',
    id: context.value,
    depth: 0,
    user: req.user, // Pass user for access control
  })

  if (exercise.lesson) {
    const lessonId = typeof exercise.lesson === 'string' ? exercise.lesson : exercise.lesson.id

    // Fetch lesson with access checks
    const lesson = await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      user: req.user, // Pass user for access control
      // DO NOT use overrideAccess here
    })
    lessonContextText = lesson.lessonContextText ?? undefined

    // Fetch prompt separately if lesson has one
    if (lesson.prompt) {
      const promptId = typeof lesson.prompt === 'string' ? lesson.prompt : lesson.prompt.id
      try {
        lessonPrompt = await req.payload.findByID({
          collection: 'prompts',
          id: promptId,
          overrideAccess: true,
        })
      } catch (error) {
        reqLogger.warn({ err: error, promptId, lessonId }, 'Failed to fetch lesson prompt')
      }
    }
  }
}

// 10) Resolve system prompt using pre-loaded prompt object
const promptResolution = await resolveAgentSystemPrompt(req.payload, lessonPrompt)

reqLogger.info(
  {
    promptId: promptResolution.promptId,
    promptTitle: promptResolution.promptTitle,
    resolvedFrom: promptResolution.resolvedFrom,
    ...(promptResolution.fallbackReason && { fallbackReason: promptResolution.fallbackReason }),
  },
  'Resolved system prompt',
)

// Inject lesson context into resolved prompt
let systemInstructions = promptResolution.template
try {
  systemInstructions = buildLessonContextPrompt(systemInstructions, lessonContextText)
} catch (error) {
  if (error instanceof Error && error.message.includes('exceeds maximum')) {
    return Response.json({ error: 'Lesson context exceeds maximum allowed size' }, { status: 400 })
  }
  throw error
}
```

**Guardrails**

- Keep all existing context policy calls unchanged: `getRecentWindow`, memory retrieval, `composePrompt`, observability.
- Do not change the "persist message first" behavior.
- Steps 11-16 remain identical.

**Access Control Consistency**

Ensure **every** protected Payload call in the endpoint passes `user: req.user`:

```typescript
// ✅ CORRECT - passes user for access control
await req.payload.findByID({
  collection: 'lessons',
  id: lessonId,
  depth: 0,
  user: req.user, // Required for access checks
})

// ✅ CORRECT - overrideAccess:true for admin-only resources
await req.payload.findByID({
  collection: 'prompts',
  id: promptId,
  overrideAccess: true, // Prompts are admin-only, safe to override
})

// ❌ WRONG - relies on implicit context (may not work consistently)
await req.payload.findByID({
  collection: 'lessons',
  id: lessonId,
  depth: 0,
  // Missing user: req.user
})
```

**Audit all Payload calls in chat.ts:**

- `findByID` for lessons → `user: req.user`
- `findByID` for exercises → `user: req.user`
- `findByID` for prompts → `overrideAccess: true` (admin-only)
- `find` for prompts (default query) → `overrideAccess: true`
- `update` for conversations → `user: req.user` (already has this)
- `findByID` for conversations → `user: req.user` (already has this)

---

## Stage 4 — Remove Markdown Prompt Dependency

**Timebox:** 1–2 hours

### 4.1 Update `src/lib/ai/services/exercise-chat-service.ts`

**Decision: Keep legacy path but make endpoint always use composedPrompt**

The endpoint will always pass `composedPrompt`. The legacy path remains for any other callers but logs a deprecation warning.

**Remove import (line 10):**

```typescript
// DELETE: import promptContent from '../prompts/exercise-chat-agent-prompt.md'
```

**Update `getSystemPrompt()` (lines 30-36):**

```typescript
// Local fallback constant - no imports to avoid circular deps
const LEGACY_FALLBACK = 'You are a helpful assistant.'

/**
 * @deprecated Use resolveAgentSystemPrompt from prompt-resolver.server instead.
 * This remains only for legacy code paths without access to Payload.
 * The main chat endpoint always provides composedPrompt, so this is only
 * reached by direct calls to chatWithExerciseHelper without composedPrompt.
 */
export function getSystemPrompt(): string {
  logger.warn('[DEPRECATED] getSystemPrompt() called - migrate to prompt resolver')
  return LEGACY_FALLBACK
}
```

**Keep legacy path in `chatWithExerciseHelper` but prefer composedPrompt:**

The function already checks `if (input.composedPrompt)` first. The legacy path (lines 139-176) remains but will only be used by callers that don't provide `composedPrompt`.

**Guardrails**

- No change to retry/timeout semantics.
- Keep markdown file for reference (don't delete).

---

## Stage 5 — Update Existing Tests + Add Coverage

**Timebox:** 2–4 hours

### 5.1 Update `tests/int/agent-chat.int.spec.ts`

**Remove `getSystemPrompt` mock - endpoint no longer uses it:**

```typescript
// OLD:
vi.mock('@/lib/ai/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'), // REMOVE THIS
}))

// NEW:
vi.mock('@/lib/ai/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
}))

// DO NOT mock prompt-resolver - let real prompt selection run
```

**Add test setup for prompts (isolated test data):**

```typescript
let testPromptId: string
let testChapterId: string

beforeAll(async () => {
  // ... existing user setup ...

  // Create isolated test data (don't modify existing data)
  const course = await payload.create({
    collection: 'courses',
    data: { title: 'Test Course', status: 'published' },
  })

  const chapter = await payload.create({
    collection: 'chapters',
    data: { title: 'Test Chapter', course: course.id, order: 1, status: 'published' },
  })
  testChapterId = chapter.id

  // Create a default prompt for tests
  const prompt = await payload.create({
    collection: 'prompts',
    data: {
      title: 'Integration Test Default Prompt',
      key: `int-test-default-${Date.now()}`, // Unique key to avoid conflicts
      template: 'You are a test assistant for integration tests.',
      status: 'published',
      isDefaultForAgentChat: true,
    },
  })
  testPromptId = prompt.id

  // ... existing exercise setup ...
})

afterAll(async () => {
  // Cleanup in reverse order
  if (testPromptId) {
    await payload.delete({ collection: 'prompts', id: testPromptId })
  }
  // ... existing cleanup ...
})
```

**Add new test cases (using isolated test data):**

```typescript
describe('prompt resolution', () => {
  it('uses lesson prompt when lesson has published prompt', async () => {
    // Create a lesson-specific prompt
    const lessonPrompt = await payload.create({
      collection: 'prompts',
      data: {
        title: 'Lesson-Specific Prompt',
        key: `lesson-prompt-${Date.now()}`,
        template: 'Custom lesson instructions.',
        status: 'published',
      },
    })

    // Create a lesson with this prompt
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson With Prompt',
        chapter: testChapterId,
        order: 1,
        status: 'published',
        prompt: lessonPrompt.id,
      },
    })

    const req = {
      payload,
      user: { id: testUserId },
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: lesson.id,
      }),
    }

    const res = await agentChat(req)
    expect(res.status).toBe(200)

    // Cleanup
    await payload.delete({ collection: 'lessons', id: lesson.id })
    await payload.delete({ collection: 'prompts', id: lessonPrompt.id })
  })

  it('falls back to default when lesson prompt is draft', async () => {
    // Create draft prompt
    const draftPrompt = await payload.create({
      collection: 'prompts',
      data: {
        title: 'Draft Prompt',
        key: `draft-prompt-${Date.now()}`,
        template: 'Draft content.',
        status: 'draft', // Not published
      },
    })

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson With Draft Prompt',
        chapter: testChapterId,
        order: 1,
        status: 'published',
        prompt: draftPrompt.id,
      },
    })

    const req = {
      payload,
      user: { id: testUserId },
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: lesson.id,
      }),
    }

    const res = await agentChat(req)
    expect(res.status).toBe(200)
    // The default prompt (testPromptId) should be used

    // Cleanup
    await payload.delete({ collection: 'lessons', id: lesson.id })
    await payload.delete({ collection: 'prompts', id: draftPrompt.id })
  })

  it('uses built-in fallback when no published default prompts exist', async () => {
    // Mock ONLY the default prompt query to return empty
    // This simulates "no published defaults" without mutating real data
    const originalFind = payload.find.bind(payload)
    const findSpy = vi.spyOn(payload, 'find').mockImplementation(async (args) => {
      // Intercept only the default prompt query
      if (
        args.collection === 'prompts' &&
        JSON.stringify(args.where).includes('isDefaultForAgentChat')
      ) {
        return {
          docs: [],
          totalDocs: 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit: 1,
          page: 1,
          pagingCounter: 1,
          totalPages: 0,
        }
      }
      // Let all other queries (conversations, etc.) run normally
      return originalFind(args)
    })

    // Create a lesson WITHOUT a prompt - will try default, get empty, use fallback
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson For Fallback',
        chapter: testChapterId,
        order: 1,
        status: 'published',
        // No prompt field - will attempt default lookup
      },
    })

    const req = {
      payload,
      user: { id: testUserId },
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: lesson.id,
      }),
    }

    const res = await agentChat(req)
    expect(res.status).toBe(200)

    // Verify the default prompt query was intercepted
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'prompts',
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({ isDefaultForAgentChat: { equals: true } }),
          ]),
        }),
      }),
    )

    // Cleanup
    findSpy.mockRestore()
    await payload.delete({ collection: 'lessons', id: lesson.id })
  })

  it('endpoint always passes composedPrompt to chatWithExerciseHelper', async () => {
    const { chatWithExerciseHelper } = await import('@/lib/ai/services/exercise-chat-service')

    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson',
        chapter: testChapterId,
        order: 1,
        status: 'published',
      },
    })

    const req = {
      payload,
      user: { id: testUserId },
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: lesson.id,
      }),
    }

    await agentChat(req)

    // Verify composedPrompt was passed
    expect(chatWithExerciseHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        composedPrompt: expect.any(Object),
      }),
    )

    await payload.delete({ collection: 'lessons', id: lesson.id })
  })
})
```

### 5.2 Unit tests already covered in Stage 2

The `tests/unit/lib/ai/prompt-resolver.spec.ts` file covers all resolver logic with logger assertions.

---

## Stage 6 — Cleanup & Documentation

**Timebox:** 30–60 minutes

**Deliverables**

1. **Verify no runtime imports of `.md` prompt file remain**

Add CI check or grep verification:

```bash
# Ensure no imports of the markdown prompt file in production code
grep -r "exercise-chat-agent-prompt.md" src/ --include="*.ts" --include="*.tsx" && exit 1 || echo "OK: No md prompt imports"
```

2. **Add comment in `agent/chat.ts`** (before Step 9):

```typescript
/**
 * System Prompt Resolution Flow (Secure Fetch Pattern)
 *
 * The system prompt is resolved at runtime (not persisted):
 * 1. Load from Lesson.prompt relationship (if exists and published)
 * 2. Fall back to global default (first with isDefaultForAgentChat=true)
 * 3. Use built-in fallback if neither available
 *
 * Security: We use a two-fetch pattern:
 * - Lesson fetched with normal access checks (preserves access control)
 * - Prompt fetched separately with overrideAccess (admin-only collection)
 *
 * After resolution, lesson context is injected via buildLessonContextPrompt()
 * to create the final system instructions for Gemini.
 */
```

2. **Remove unused imports** from endpoint (if any remain)

3. **Keep markdown file** (`exercise-chat-agent-prompt.md`) for reference

4. **Verify logs are actionable:**
   - Info: resolved prompt ID, title, source
   - Warn: fallback usage with reason, multiple defaults (include lessonId + promptId)
   - Debug: prompt not published status

---

## Test Plan (Summary)

### Unit tests

- `tests/unit/lib/ai/prompt-resolver.spec.ts` - all 8 resolver cases with logger assertions

### Integration tests

- `tests/int/agent-chat.int.spec.ts`:
  - Chat with lessonId referencing lesson with published prompt
  - Chat with lessonId referencing lesson without prompt (uses default)
  - Chat with prompt in draft/archived (uses default)
  - Chat with no published prompts (uses built-in fallback)
  - Verify endpoint always passes composedPrompt to service

### Test data isolation

- Each test creates its own prompts/lessons with unique keys
- No "delete all prompts" operations
- Cleanup in afterAll/afterEach

### Non-goals

- No end-to-end browser tests required in this task.

---

## Observability Requirements

- Log once per request:
  - `resolvedPromptId` and/or `resolvedPromptTitle`
  - `resolvedFrom`: 'lesson-prompt' | 'default-prompt' | 'fallback'
  - `fallbackReason` if fallback used
- Warn if multiple published defaults exist
- Do not log full prompt contents in production.

---

## Acceptance Criteria

- [ ] `src/collections/Prompts.ts` created with all fields and adminOnly access
- [ ] `src/collections/Lessons.ts` updated with `prompt` relationship
- [ ] `src/payload.config.ts` registers Prompts collection
- [ ] `src/lib/ai/prompt-resolver.server.ts` implemented with all fallback cases
- [ ] `src/endpoints/agent/chat.ts` uses secure fetch pattern and resolver
- [ ] `src/lib/ai/services/exercise-chat-service.ts` - `getSystemPrompt()` deprecated, md import removed
- [ ] `tests/unit/lib/ai/prompt-resolver.spec.ts` - all 8 test cases pass with logger assertions
- [ ] `tests/int/agent-chat.int.spec.ts` - updated with real prompt selection, isolated test data
- [ ] CI passes (typecheck, lint, all tests)
- [ ] No duplicate user message in Gemini history
- [ ] Clear fallback behavior and logs

---

## Notes / Future Follow-ups (Not in this task)

- Add overrides for Exercise → Lesson fallback.
- Add prompt selection for other models (Course/Chapter/Exercise/ingest).
- Add placeholders/inputVars and publish-time validation.
- Add version tracking for prompt changes.
- Consider caching default prompt query.
