# Plan: Fix "Approve with Answers" Flow

## Research Findings

### File paths verified
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — approve action at L83-86, `feedback` accepted in schema (L50) but ignored by approve handler
- ✅ `src/ui/cody/api.ts` — `approveGate()` at L179-185, currently sends no feedback
- ✅ `src/ui/cody/hooks/index.ts` — `approveGate` mutation at L326-330, takes no args
- ✅ `src/ui/cody/components/TaskDetail.tsx` — `getPrimaryAction()` at L221-272, "Retry with Context" pattern at L804-849
- ✅ `scripts/cody/clarify-workflow.ts` — `extractContentAfterKeyword()` at L252-267 already parses text after `/cody approve`
- ✅ `src/ui/cody/task-parser.ts` — `CLARIFY_STOP` regex at L19, detects clarify-waiting state

### Patterns observed
- "Retry with Context" block (L804-849) is the exact UI pattern to follow: collapsible section with textarea + submit
- `useRetryWithContext` hook (L233-253) shows mutation pattern accepting a string arg
- `clarifyWaiting` is derived from `clarify-stop` comment type in task-parser.ts
- CI-side `extractContentAfterKeyword()` already handles multiline text after `/cody approve`

### Integration points
- API schema already accepts `feedback` field — just needs wiring into approve case
- `approveGate()` plumbing: api.ts → hooks/index.ts → TaskDetail.tsx

## Reuse Inventory

### Existing code to reuse
- `extractContentAfterKeyword()` from `scripts/cody/clarify-workflow.ts` — already parses answers from approve comments (no change needed)
- `withActor()` from `route.ts` L60-62 — used for actor attribution in comments
- "Retry with Context" pattern from `TaskDetail.tsx` L804-849 — UI template for the answer panel
- `useRetryWithContext` hook pattern from `hooks/index.ts` L233-253 — mutation accepting string arg
- `handleSuccess()`/`handleError()` from `useTaskActions` — toast pattern for mutations

### New code justified
- "Answer & Approve" block in TaskDetail.tsx — new UI for clarify-waiting state (nothing like it exists)

---

## Step 1: API route — include feedback in approve comment

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — L83-86)

**Behavior**:

Modify the `approve` case to include `feedback` when present:

```typescript
case 'approve': {
  const comment = feedback
    ? withActor(`/cody approve\n\n${feedback}`, actor)
    : withActor('/cody approve', actor)
  await postComment(issueNumber, comment)
  return NextResponse.json({ success: true, message: 'Gate approved' })
}
```

All text after `/cody approve` is preserved verbatim — no format restrictions. The CI-side `extractContentAfterKeyword()` in `clarify-workflow.ts` already handles parsing everything after the keyword.

**Tests** (FAIL before, PASS after):
- `tests/unit/api/cody/actions-approve.test.ts`:
  - POST `{ action: 'approve' }` (no feedback) → posts `/cody approve` (backward compatible)
  - POST `{ action: 'approve', feedback: 'Answer 1: Option A\nAnswer 2: Option B' }` → posts `/cody approve\n\n<feedback>`
  - POST `{ action: 'approve', feedback: '...', actorLogin: 'user1' }` → includes actor attribution

**Acceptance Criteria**:
- [ ] Approve without feedback posts bare `/cody approve` (backward compatible)
- [ ] Approve with feedback posts `/cody approve\n\n<verbatim feedback>`
- [ ] Actor attribution preserved in both cases
- [ ] No changes to other action handlers

---

## Step 2: API client — add feedback param to approveGate

**Files to Touch**:
- `src/ui/cody/api.ts` (MODIFIED — L179-185)

**Behavior**:

Add optional `feedback` parameter to `approveGate()`:

```typescript
approveGate: async (issueNumber: number, actorLogin?: string, feedback?: string): Promise<ActionResponse> => {
  const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'approve',
      ...(actorLogin && { actorLogin }),
      ...(feedback && { feedback }),
    }),
  })
  return handleResponse(res)
},
```

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/api.test.ts`:
  - `approveGate(123)` sends `{ action: 'approve' }` (no feedback key)
  - `approveGate(123, 'user1', 'my answers')` sends `{ action: 'approve', actorLogin: 'user1', feedback: 'my answers' }`

**Acceptance Criteria**:
- [ ] Calling without feedback omits feedback from body (backward compatible)
- [ ] Calling with feedback includes it in the POST body
- [ ] Existing callers (`useTaskActions.approveGate()`) still work without changes

---

## Step 3: Hooks — accept feedback arg in approveGate mutation

**Files to Touch**:
- `src/ui/cody/hooks/index.ts` (MODIFIED — L326-330)

**Behavior**:

Change `approveGate` mutation to accept optional string:

```typescript
const approveGate = useMutation({
  mutationFn: (feedback?: string) => codyApi.tasks.approveGate(issueNumber, actorLogin, feedback),
  onSuccess: handleSuccess('Gate approved'),
  onError: handleError('approve gate'),
})
```

Return type changes: `approveGate: approveGate.mutate` now accepts `(feedback?: string)`.

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/hooks.test.ts`:
  - `approveGate()` calls `codyApi.tasks.approveGate(issueNumber, actorLogin, undefined)`
  - `approveGate('my answers')` calls `codyApi.tasks.approveGate(issueNumber, actorLogin, 'my answers')`

**Acceptance Criteria**:
- [ ] `approveGate()` without args still works (backward compatible)
- [ ] `approveGate('text')` passes feedback through to API client

---

## Step 4: TaskDetail UI — "Answer & Approve" panel for clarify-waiting

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — state ~L589, getPrimaryAction ~L236, new block ~L850, render ~L923)

**Behavior**:

1. **New state** (next to existing `retryContext`/`showRetryContext` at ~L589):
   ```typescript
   const [answerText, setAnswerText] = useState('')
   const [showAnswerInput, setShowAnswerInput] = useState(false)
   ```

2. **Modify `getPrimaryAction()`** (L236-248):
   When `task.clarifyWaiting && task.column === 'gate-waiting'`, return:
   ```
   icon: MessageSquare
   label: 'Answer & Approve'
   pendingLabel: 'Approving…'
   onClick: toggle showAnswerInput (don't call approve directly)
   pendingKey: 'approve'
   variant: 'blue'
   ```
   This replaces the plain "Approve Gate" when clarify is waiting.
   When `task.column === 'gate-waiting' && !task.clarifyWaiting`, keep existing "Approve Gate" behavior.

3. **New "Answer & Approve" block** (after retryWithContextBlock, ~L850):
   Blue-tinted collapsible matching the retry-with-context pattern:
   - Collapsible header: "Answer & Approve" with `MessageSquare` icon, blue styling
   - Expanded content:
     - `<textarea>` for answers (placeholder: "Provide your answers…")
     - Hint: `Posts /cody approve + your answers`
     - Submit button: calls `taskActions.approveGate(answerText)`, shows loading state
     - On success: clear `answerText`, close panel

4. **Render** the block in the comments tab area (L923, next to `{retryWithContextBlock}`):
   ```tsx
   {answerAndApproveBlock}
   ```

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/components/TaskDetail.test.tsx`:
  - When `clarifyWaiting=true` and `column='gate-waiting'`, primary action shows "Answer & Approve"
  - When `clarifyWaiting=false` and `column='gate-waiting'`, primary action shows "Approve Gate" (unchanged)
  - Clicking "Answer & Approve" toggles the answer panel open
  - Typing in textarea and clicking submit calls `approveGate` with the answer text

**Acceptance Criteria**:
- [ ] "Answer & Approve" button appears when `clarifyWaiting && gate-waiting`
- [ ] Plain "Approve Gate" still works when not clarify-waiting
- [ ] Clicking primary action toggles panel open (does not approve immediately)
- [ ] Textarea accepts free-form text
- [ ] Submit sends answer text through `approveGate(answerText)`
- [ ] Panel closes and text clears on success
- [ ] Blue-tinted styling matches project theme (consistent with retry-with-context pattern)

---

## Summary

| Step | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | API route: wire feedback into approve comment | 1 file (modified) | 5 min |
| 2 | API client: add feedback param to approveGate | 1 file (modified) | 5 min |
| 3 | Hooks: accept feedback arg in mutation | 1 file (modified) | 5 min |
| 4 | TaskDetail UI: Answer & Approve panel | 1 file (modified) | 20 min |
| **Total** | | **4 files** | **~35 min** |

### Key Design Decisions
1. **All text after approve is preserved verbatim** — no format restrictions, no parsing on the UI side
2. **CI side already handles this** — `extractContentAfterKeyword()` in clarify-workflow.ts strips the `approve` keyword and captures everything after
3. **Toggle panel pattern** — matches existing "Retry with Context" UX, consistent experience
4. **Backward compatible** — all existing approve flows (no feedback) work unchanged
5. **Blue theme for clarify** — distinguishes from orange retry-with-context
