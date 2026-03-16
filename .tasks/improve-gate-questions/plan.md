# Plan: Improve Gate Question Quality

## Problem

Approval gates in the Cody pipeline ask irrelevant implementation-detail questions that downstream agents (architect, build) should answer — not the human reviewer. Analysis of 13 real task.json files shows:

- **~63% of gate questions are implementation details** (e.g., "Where is the component?", "What's the data structure?")
- **~23% are genuine product/business decisions** that actually need human input
- **~14% are borderline/architectural**

**Root cause**: The taskify agent prompt (`.opencode/agents/taskify.md` lines 57-93) has insufficient guardrails. The "bad examples" section only covers 4 patterns phrased as "are there existing..." — it misses the most common offenders like "Where is X?" and "What component does Y?". There is also no runtime safety net.

## Research Findings

- ✅ `.opencode/agents/taskify.md` — contains `review_questions` prompt guidance (lines 57-93)
- ✅ `scripts/cody/clarify-workflow.ts` — `formatGateComment()` renders questions (lines 272-346)
- ✅ `scripts/cody/pipeline-utils.ts` — `TaskDefinition` interface with `review_questions?: string[]` (line 171)
- ✅ `.tasks/*/task.json` — 13 real examples with non-empty `review_questions` arrays analyzed
- ✅ `.opencode/agents/architect.md` — architect's mandatory research checklist already covers all implementation-detail questions

### Real Bad Questions Found (from production gate comments)

| Question | Task | Verdict |
|----------|------|---------|
| "What component renders the PDF/document in lessons?" | 260313-auto-110 | Implementation — architect discovers via file search |
| "Where are lessons queried for the website frontend?" | 260311-auto-416 | Implementation — architect discovers via grep |
| "Does the lessons collection have an 'order' field?" | 260311-auto-416 | Implementation — architect reads the schema |
| "Is the video field stored as a relationship or direct URL?" | 260309-auto-347 | Implementation — architect reads the collection config |
| "Are there any existing tests for formatSlug?" | 260303-auto-65 | Implementation — architect greps for tests |
| "Where should the shared utility be located?" | 260306-auto-330 | Implementation — architect follows project conventions |
| "What PDF viewing library is being used?" | 260313-auto-110 | Implementation — architect reads package.json/imports |
| "Should we put this in lib/utils or ui/cody?" | 260306-auto-330 | Implementation — architect decides based on patterns |

### Real Good Questions Found (genuine product decisions)

| Question | Task | Why it needs human input |
|----------|------|--------------------------|
| "Should the empty grid warning block save, or allow save with warning?" | 260313-auto-965 | UX trade-off |
| "Is adding a 'claiming' state to the collection acceptable?" | 260309-auto-882 | Data model design choice |
| "Should we migrate existing broken Hebrew slugs, or only fix new ones?" | 260303-auto-65 | Data migration scope |
| "Should we use adminOnly or isAdminOrOwner pattern?" | 260306-auto-487 | Security model choice |
| "Should the cron cleanup be less aggressive given this fix?" | 260309-auto-882 | Operational trade-off |
| "Should existing study plans be regenerated or only new ones?" | 260302-auto-25 | Migration scope |

## Reuse Inventory

- Reuse `formatGateComment()` in `scripts/cody/clarify-workflow.ts` — add filtering before rendering
- Reuse existing `TaskDefinition` interface — no schema changes needed (Step 3 deferred)
- No new utilities needed — the filter function lives inline in clarify-workflow.ts

---

## Step 1: Rewrite `review_questions` prompt section in taskify agent

**Files to Touch**:
- `.opencode/agents/taskify.md` (MODIFIED — lines 57-93)

**Exact Behavior**:

Replace the "Review Questions (Gate Guidance)" section with a tighter version containing:

1. **Litmus test rule** (mandatory self-check for every question):
   > "For each question, apply this test: *Could an engineer with full codebase access answer this without talking to the product owner?* If yes → put it in `assumptions`, NOT `review_questions`."

2. **Explicit blocklist** of implementation-detail patterns with real examples:
   - ❌ "Where is [component/file/function] located?"
   - ❌ "What [component/field/structure] does [X] use?"
   - ❌ "How is [X] currently [stored/rendered/handled/structured]?"
   - ❌ "Are there existing [tests/patterns/utilities] for [X]?"
   - ❌ "Does [collection/schema] have [field/property]?"
   - ❌ "Should we place/put this in [directory A] or [directory B]?"
   - ❌ "What is the current [behavior/implementation/default] for [X]?"
   - ❌ "Is there any [device/browser]-specific logic?"

3. **Annotated positive examples** grouped by decision category:
   - **Scope decisions**: "The issue could be scoped to admin only, or also student preview. Which scope?" *(Why: only the product owner can decide feature scope)*
   - **Migration decisions**: "Should we migrate existing broken data, or only fix new entries going forward?" *(Why: production data impact requires human sign-off)*
   - **UX trade-offs**: "Should the validation be a blocking error or a non-blocking warning?" *(Why: UX behavior isn't specified in the issue)*
   - **Security model**: "Should we restrict to adminOnly or allow the resource owner too?" *(Why: security policy is a business decision)*
   - **External dependencies**: "This requires adding library X (~200KB). Approve, or implement with vanilla JS?" *(Why: dependency decisions need human authority)*

4. **Stronger default-to-empty directive**:
   > "Most tasks need 0 questions. Default to `[]`. Only add a question if the task literally cannot proceed without a human making a choice between two or more valid options."

**Tests (manual verification)**:
- Re-read the 8 "bad question" examples above and confirm each would be caught by the new blocklist
- Re-read the 6 "good question" examples and confirm each would still pass the litmus test
- Confirm the section is ≤40 lines (keep it concise for LLM context)

**Acceptance Criteria**:
- [ ] Litmus test rule is present and clearly stated
- [ ] ≥8 explicit blocklist patterns with ❌ markers
- [ ] ≥5 annotated positive examples with *(Why: ...)* explanations
- [ ] Default-to-empty directive present
- [ ] Section ≤40 lines total

---

## Step 2: Add runtime implementation-question filter in gate comment formatter

**Files to Touch**:
- `scripts/cody/clarify-workflow.ts` (MODIFIED — add function near line 270, modify `formatGateComment` at lines 322-328)

**Exact Behavior**:

1. Add `isImplementationQuestion(question: string): boolean` function before `formatGateComment`:
   ```
   Regex patterns (derived from real bad questions):
   - /where (?:is|are|should) (?:the|this|we)/i
   - /what (?:component|file|function|class|module|library)/i
   - /how is .+ (?:currently|stored|structured|rendered|implemented|handled)/i
   - /(?:are|is) there (?:existing|any existing|any)/i
   - /does (?:the|this) .+ (?:have|contain|include|use)/i
   - /what is the current/i
   - /should (?:we|this|it) (?:be placed|be located|go) in/i
   ```

2. In `formatGateComment()`, split `reviewQuestions` into two lists:
   - `productQuestions` — pass the filter (NOT implementation questions)
   - `implQuestions` — caught by the filter

3. Render `productQuestions` under "### Review Questions" as before.

4. If `implQuestions` is non-empty, render them under a collapsed `<details>` block titled "Implementation Notes (auto-filtered)" — visible but clearly not blocking questions.

**Tests**:

- Test file: `tests/unit/cody/clarify-workflow.test.ts` (NEW or extend existing)
- Test: `isImplementationQuestion` returns `true` for all 8 known bad patterns
- Test: `isImplementationQuestion` returns `false` for all 6 known good patterns  
- Test: `formatGateComment` moves impl questions to collapsed section
- Run: `pnpm vitest run tests/unit/cody/clarify-workflow.test.ts`

**Acceptance Criteria**:
- [ ] `isImplementationQuestion()` function exported and tested
- [ ] All 8 real bad questions from research are caught by the filter
- [ ] All 6 real good questions from research pass through the filter
- [ ] Gate comment renders filtered questions in a collapsed `<details>` section
- [ ] `pnpm tsc --noEmit` passes
- [ ] Unit tests pass

---

## Summary

| Step | File | Change Type | Effort |
|------|------|-------------|--------|
| 1 | `.opencode/agents/taskify.md` | MODIFIED (lines 57-93) | ~20 min |
| 2 | `scripts/cody/clarify-workflow.ts` | MODIFIED (add filter + modify formatter) | ~30 min |
| 2 | `tests/unit/cody/clarify-workflow.test.ts` | NEW (unit tests for filter) | ~15 min |

**Total estimated effort**: ~1 hour

**Expected impact**: Gate questions should drop from ~63% implementation-detail to <15%, with the runtime filter catching any that slip through the improved prompt.
