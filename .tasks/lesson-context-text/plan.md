TDD Plan: Lesson Full-Context Injection (MVP)
Goal
Inject lesson-level textual context into chat prompts at runtime without persisting in conversations or messages.

Architecture Overview

┌─────────────────────────────────────────────────────────────────┐
│ Chat Request Flow │
├─────────────────────────────────────────────────────────────────┤
│ 1. User sends message with lessonId │
│ 2. Fetch lesson.lessonContextText from DB │
│ 3. Call buildLessonContextPrompt(systemPrompt, lessonContext) │
│ 4. Pass enriched prompt to composePrompt() │
│ 5. Send to AI model │
│ 6. Store ONLY user message + AI response (NO lesson context) │
└─────────────────────────────────────────────────────────────────┘
Key Constraint: Lesson context is injected at runtime via buildLessonContextPrompt() and NEVER stored in conversations/messages.

Files to Modify/Create
File Action Purpose
src/collections/Lessons.ts MODIFY Add lessonContextText field
src/lib/ai/lesson-context.ts CREATE Single-responsibility injection function
src/endpoints/agent/chat.ts MODIFY Fetch lesson + call buildLessonContextPrompt
tests/unit/collections/lessons-schema.spec.ts CREATE Schema tests
tests/unit/lib/ai/lesson-context.spec.ts CREATE Unit tests for injection function
tests/int/lesson-context-injection.int.spec.ts CREATE Integration tests
Test Strategy (Test-First)

1. Schema Tests
   File: tests/unit/collections/lessons-schema.spec.ts

Test Assertion
should have lessonContextText field Field exists in Lessons.fields
should be textarea type field.type === 'textarea'
should be optional field.required is falsy
should NOT be indexed field.index is falsy 2. Conversation Integrity Tests
File: tests/unit/collections/conversations-schema.spec.ts (extend)

Test Assertion
should NOT have lessonContext field Field undefined in Conversations
messages should NOT have lessonContext No such field in messages array schema 3. Prompt Composition Unit Tests
File: tests/unit/lib/ai/lesson-context.spec.ts

Test Assertion
should inject lessonContextText into system prompt Result contains lesson content + delimiters
should preserve original system prompt Base prompt still present
should return original when lessonContext is undefined Unchanged, no delimiters
should return original when lessonContext is empty Unchanged
should reject oversized lessonContext Throws error with "exceeds maximum"
should accept context at exactly max size No error
should wrap context in delimiters LESSON_CONTEXT_START before content, LESSON_CONTEXT_END after 4. Integration Tests
File: tests/int/lesson-context-injection.int.spec.ts

Test Assertion
should inject lessonContextText into composed prompt Model receives prompt with lesson content
should NOT persist lessonContextText in messages DB query shows no lesson markers in stored messages
should inject only current lesson context Lesson A context present, Lesson B absent
should reject oversized context without calling model 400 response, mock not called
should verify stored messages never contain lesson markers After multiple messages, no LESSON_CONTEXT_START in DB
Implementation Details

1. Lessons Collection Field

// src/collections/Lessons.ts - Add after contentFiles field
{
name: 'lessonContextText',
type: 'textarea',
admin: {
description: 'AI context text for this lesson. Injected into chat prompts at runtime. NOT indexed or searchable.',
},
// NOT indexed, NOT required
}, 2. Lesson Context Module

// src/lib/ai/lesson-context.ts
export const LESSON_CONTEXT_MAX_CHARS = 100_000 // ~50K tokens
export const LESSON_CONTEXT_BLOCK_START = 'LESSON_CONTEXT_START'
export const LESSON_CONTEXT_BLOCK_END = 'LESSON_CONTEXT_END'

export function buildLessonContextPrompt(
baseSystemPrompt: string,
lessonContextText: string | undefined | null,
): string {
if (!lessonContextText?.trim()) return baseSystemPrompt

if (lessonContextText.length > LESSON_CONTEXT_MAX_CHARS) {
throw new Error(`Lesson context exceeds maximum allowed size`)
}

return [
baseSystemPrompt,
'',
LESSON_CONTEXT_BLOCK_START,
'## Lesson Context',
lessonContextText.trim(),
LESSON_CONTEXT_BLOCK_END,
].join('\n')
} 3. Chat Endpoint Integration
Location: src/endpoints/agent/chat.ts (around line 257, before composePrompt call)

// Fetch lesson context if applicable
let lessonContextText: string | undefined
if (context.relationTo === 'lessons') {
const lesson = await req.payload.findByID({
collection: 'lessons',
id: context.value,
depth: 0,
})
lessonContextText = lesson.lessonContextText ?? undefined
} else if (context.relationTo === 'exercises') {
// Exercises inherit lesson context
const exercise = await req.payload.findByID({
collection: 'exercises',
id: context.value,
depth: 0,
})
if (exercise.lesson) {
const lessonId = typeof exercise.lesson === 'string' ? exercise.lesson : exercise.lesson.id
const lesson = await req.payload.findByID({
collection: 'lessons',
id: lessonId,
depth: 0,
})
lessonContextText = lesson.lessonContextText ?? undefined
}
}

// Inject lesson context (single responsibility)
let systemInstructions = getSystemPrompt()
try {
systemInstructions = buildLessonContextPrompt(systemInstructions, lessonContextText)
} catch (error) {
if (error instanceof Error && error.message.includes('exceeds maximum')) {
return Response.json({ error: 'Lesson context exceeds maximum allowed size' }, { status: 400 })
}
throw error
}
Execution Order
Write unit tests first (all should fail)

tests/unit/collections/lessons-schema.spec.ts
tests/unit/lib/ai/lesson-context.spec.ts
Implement schema change

Add lessonContextText field to src/collections/Lessons.ts
Run pnpm generate:types
Write integration tests (will fail)

tests/int/lesson-context-injection.int.spec.ts
Implement injection function

Create src/lib/ai/lesson-context.ts
Integrate into chat endpoint

Modify src/endpoints/agent/chat.ts
Run all tests - All should pass

Verify persistence invariant

Manually test: send chat in lesson context
Query DB: verify messages don't contain lesson markers
Verification Commands

# Run unit tests

pnpm exec vitest run tests/unit/collections/lessons-schema.spec.ts
pnpm exec vitest run tests/unit/lib/ai/lesson-context.spec.ts

# Run integration tests

pnpm exec vitest run tests/int/lesson-context-injection.int.spec.ts

# Run all tests

pnpm test

# Verify no lesson context in conversations (manual)

# In MongoDB shell or Compass:

db.conversations.find({ "messages.content": /LESSON_CONTEXT_START/ })

# Should return empty

Single Responsibility Verification
After implementation, grep the codebase:

grep -r "lessonContextText" src/
Should ONLY appear in:

src/collections/Lessons.ts (field definition)
src/lib/ai/lesson-context.ts (injection function)
src/endpoints/agent/chat.ts (fetch + call)
src/payload-types.ts (generated types)
If it appears elsewhere, the single responsibility principle is violated.

Out of Scope
PDF parsing
Text extraction
Chunking
Vector search
Embeddings
LangChain
memory_items
Engineering Rule
If a future refactor replaces full-context injection with retrieval-based logic, only buildLessonContextPrompt() tests and implementation should change.
