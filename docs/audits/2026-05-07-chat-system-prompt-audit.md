# Chat System Prompt — Data-Correctness Audit (2026-05-07)

## Why this exists

After three rounds of fixes on issue #1403 (PR #1404, #1450, #1459, #1461) the chat
still answered with wrong data — wrong exercise counts, missing lesson context,
canned image refusals on text-only chat. Every fix revealed another data-shape
mismatch. Stepping back: rather than continue patching, audit what actually
reaches the model and catalogue every divergence in one place.

The audit was conducted by hitting the new `/api/agent/chat/debug-prompt`
endpoint (PR #1466) live on `dev.aguy.co.il` against the canonical test
lesson `lesson-1` (id `69a01f6bc774d3c6ad807afd` — "דימיון משולשים", grade 9).

## Live response excerpt

```jsonc
{
  "context": {
    "relationTo": "lessons",
    "value": "69a01f6bc774d3c6ad807afd",
    "contextKey": "lessons:69a01f6bc774d3c6ad807afd"
  },
  "hasImageAttached": false,
  "promptResolution": { "resolvedFrom": "fallback", "fallbackReason": "Lesson has no prompt and no default available" },
  "teacherProfile": { "slug": "teacher_patient", "resolvedFrom": "user-settings" },
  "lessonContext": {
    "lessonContextBlock": null,            // ← BUG
    "lessonContextText": null,
    "exerciseCount": 31                    // ← lesson actually has 29 exercises + 2 explanation pages
  },
  "composedSystemMessageLength": 14530      // ← oversized
}
```

The first 31 entries in `exercises[]`:

```
 1. תרגיל 14 - דימיון משולשים    ← starts at exercise 14, not 1
 2. תרגיל 12 - דימיון משולשים    ← skips 13
 3. תרגיל 29 - משולשים דומים
 ...
29. תרגיל 1 - דימיון משולשים     ← exercise 1 is 29th in the list
30. הסבר 2                         ← explanation page, NOT an exercise
31. הסבר 1                         ← explanation page, NOT an exercise
```

## Findings, ranked by impact

### F1 — `lessonContextBlock` is empty for the lesson path (regression)

**Severity:** HIGH — the block PR #1450 added has been silently empty for any chat
opened on a `/lessons/:slug` page since `select` was introduced.

**Root cause:** [`fetchLessonContext`](../../src/server/payload/endpoints/agent/chat/prompt-composition.ts#L218)
fetches the lesson with a `select` clause that only includes
`lessonContextText`, `description`, `prompt`. `title` and `chapter` are
stripped from the result. `buildLessonContextBlock(lesson, chapter, course)`
then has no titles → returns `undefined` → block isn't injected.

The exercise path (`fetchExerciseLessonContext`) does its own findByID without
a `select` clause and works correctly. That's why the bug never showed up in
local diag for the exercise path.

**Fix:** add `title`, `type`, `chapter` to the `select` clause OR remove it
entirely (the lesson doc is small).

### F2 — Exercises list pulls from the wrong source of truth

**Severity:** HIGH — the model sees 31 entries when the student-visible
lesson page has 29 exercises (plus 2 explanation pages).

**Root cause:** [`fetchLessonContextForContext`](../../src/server/payload/endpoints/agent/chat/prompt-composition.ts#L420-L445)
queries `Exercise.lesson === lessonId` (reverse lookup). This pulls every
document tagged with that lesson, including:

- Explanation pages (`הסבר 1`, `הסבר 2`) — stored as documents in the
  `exercises` collection but functionally lesson intro pages, not exercises.
- Drafts (no `status: 'published'` filter).
- Items not actually wired into the lesson's display.

The lesson's own `blocks[]` array is the curated, ordered list of what the
student sees on the page. We should use that as the source of truth for
"what exercises are in this lesson".

**Fix:** read `lesson.blocks[]`, filter `block.blockType === 'exerciseRef'`,
fetch each referenced exercise. Order matches the page.

### F3 — Exercises returned in arbitrary order

**Severity:** MEDIUM — affects model reasoning about "first exercise",
"next exercise", and exercise counting.

**Root cause:** Same query as F2, no `sort` clause. Mongo returns documents
in default insertion order, which produces sequences like
`[14, 12, 29, 28, ..., 1]` — not the order the student sees.

**Fix:** Same as F2 (using `blocks[]` gives the right order for free).

### F4 — Composed system message is 14,530 chars

**Severity:** MEDIUM — dilutes model attention; correlates with model
hallucinating exercise counts and contents.

**Sources:**
- "Lesson Exercises" section: ~10k chars (full content of all 31 items
  including all sub-questions of each).
- IMAGE_HANDLING block (1.5k chars) — already gated by PR #1459 when no
  image is attached.
- MATH_FORMATTING + Markdown rules (1.5k chars) — fine.
- BUILTIN_FALLBACK_PROMPT (~600 chars) — used because no admin Prompt
  is linked to this lesson.

**Fix:**
- Cap exercise content at e.g. 4 KB total. Beyond that, list titles only
  and append `"…and N more exercises in this lesson"`.
- Per-exercise content cap (e.g., first 200 chars of body + sub-question
  prompts).

### F5 — Hint and solution data leaked into the system prompt

**Severity:** HIGH for content-integrity — `formatExerciseContent` emits
`[Free Response Question]` answers and full solutions for every exercise.
The model could regurgitate them verbatim if asked the right way.

**Source:** [`formatExerciseContent`](../../src/infra/llm/prompt-composer.server.ts#L160)
and [`buildLessonContextBlock`](../../src/server/payload/endpoints/agent/chat/prompt-composition.ts#L125)
both extract `prompt`, `hint`, `solution`, `answer` fields from question_*
blocks and put them in the prompt.

**Fix:** strip `solution` and `answer` fields. Mark `hint` as
"do not reveal directly" (already done in `buildLessonContextBlock`, missing
in `formatExerciseContent`).

### F6 — `composeSystemInstructions` has 8 positional args and growing

**Severity:** LOW for the user, MEDIUM for maintenance. Source of bug
proliferation: every fix this session bolted on another conditional
(`hasImageAttached`, `lessonContextBlock`, `exercises[]`, etc.). PR #1461
existed only because `pipeline.ts` was passing `undefined, undefined` for
two of the eight args.

**Fix:** convert to a typed builder/registry pattern. Each block declares
`{name, render(ctx), when(ctx), order}`. Adding a new block is one entry,
not editing the function signature in 5 places. Defer until F1–F5 land
(otherwise we copy bugs forward).

### F7 — `lesson-1` has no admin-linked Prompt and no default Prompt

**Severity:** PRODUCT — not a bug, but means every lesson chat falls back
to `BUILTIN_FALLBACK_PROMPT` ("You are a helpful math and science tutor..."),
which gives the model no curriculum-specific guidance. The lesson context
block (when fixed per F1) does part of this job, but a per-lesson prompt
would do much better.

**Fix:** out of scope for this audit. Track separately as a content task.

## Proposed fix sequence

1. **F1 — `select`-clause regression.** One-line edit. Drop the clause or add
   `title`, `type`, `chapter`. ~10 minutes.
2. **F2 + F3 — exercises source of truth.** Rewrite the exercise fetch to
   walk `lesson.blocks[]` and resolve `exerciseRef` blocks in order, with a
   `status: 'published'` filter. ~half day.
3. **F5 — strip solution/answer from injected exercise content.** Edit
   `formatExerciseContent` and double-check `buildLessonContextBlock`.
   ~1 hour.
4. **F4 — cap prompt size.** Add per-exercise + total budget. Add a tail
   "...N more exercises" if truncated. ~2 hours.
5. **F6 — refactor.** Block registry. ~2 days, only after 1–4 land and
   we've seen one or two release cycles without new bugs.

Each fix gets a debug-prompt assertion: run the endpoint before/after,
diff the response, confirm only the targeted divergence changed.

## Test plan

- Continue using `/api/agent/chat/debug-prompt` for HTTP-side ground truth
  on dev.
- Continue using `scripts/diag-debug-prompt.ts` for local dev-DB inspection
  while iterating.
- After each fix, snapshot the debug response for `lesson-1` into
  `tests/fixtures/debug-prompt-lesson-1.json` so regressions are caught
  by `pnpm test:int`.
