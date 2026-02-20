# Plan: 150226-in-lession-creation-in-payload

## Rerun Context

**Previous approach**: Added a denormalized `adminTitle` text field to the `chapters` collection, set `useAsTitle: 'adminTitle'`, and used three hooks:

1. `computeAdminTitle` (beforeChange) — sets `adminTitle` when a chapter is created/updated
2. `computeAdminTitleOnRead` (afterRead) — computes `adminTitle` on-the-fly for legacy chapters missing it
3. `cascadeAdminTitle` (afterChange on courses) — updates chapters when a course title changes

**What broke**: When Payload's admin UI fetches chapters for the relationship dropdown, it uses `select: { adminTitle: true }` (since `useAsTitle: 'adminTitle'`). This means only `id` and `adminTitle` are returned from the DB. The `afterRead` hook (`computeAdminTitleOnRead`) tries to read `doc.title` and `doc.course` — but those fields are **stripped** by the `select` clause. For chapters where `adminTitle` is `null` in the DB (legacy data, or any edge case), the hook cannot compute the title, resulting in "untitled - ID: [id]".

**Fix strategy**: The `afterRead` hook is the wrong safety net for this problem. Instead:

1. **Remove `computeAdminTitleOnRead`** — it's unreliable because Payload's `select` strips the fields it needs.
2. **Keep the `beforeChange` hook** (`computeAdminTitle`) — this correctly sets `adminTitle` when chapters are saved. It has access to `data` which always contains the full document.
3. **Keep the cascade hook** (`cascadeAdminTitle`) — correctly updates chapters when course title changes.
4. **Add a one-time migration script** to backfill all existing chapters that have `null`/empty `adminTitle`. This is more reliable than an `afterRead` hook because it permanently fixes the data.

This is simpler, more reliable, and avoids the `select`-stripping issue entirely. Once all chapters have `adminTitle` persisted, the `afterRead` hook is unnecessary.

---

## Step 1: Remove the `afterRead` Hook from Chapters Collection

**Goal**: Stop using the unreliable `afterRead` hook that fails when Payload strips fields via `select`.

**Files to touch**:

- `src/server/payload/collections/Chapters.ts` (MODIFIED, lines 7-8, 35)
- `src/server/payload/hooks/chapters/computeAdminTitleOnRead.ts` (DELETE)

**Exact behavior**:

- Remove the import of `computeAdminTitleOnRead` from `Chapters.ts`
- Remove the `afterRead: [computeAdminTitleOnRead]` line from the hooks config
- Delete the file `src/server/payload/hooks/chapters/computeAdminTitleOnRead.ts`

**Tests** (modify existing test file `tests/int/chapter-admin-title.int.spec.ts`):

1. **Test: `adminTitle` is set on create** — Already exists (test "creates chapter with adminTitle containing chapter and course title"). Should still PASS because the `beforeChange` hook sets it.
2. **Test: `adminTitle` persists correctly after re-read with select** — Add new test that reads a chapter with `select: { adminTitle: true }` and verifies `adminTitle` is the stored value (not null/empty). This confirms the `beforeChange` hook wrote it to DB.

**Acceptance criteria**:

- [ ] `computeAdminTitleOnRead.ts` file no longer exists
- [ ] `Chapters.ts` does not import or reference `computeAdminTitleOnRead`
- [ ] `Chapters.ts` still has `afterRead` removed (no `afterRead` key in hooks)
- [ ] Existing tests for `adminTitle` on create still pass
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

## Step 2: Create Backfill Migration Script

**Goal**: Permanently fix all existing chapters with null/empty `adminTitle` by computing and persisting the value. This replaces the unreliable `afterRead` fallback. [FR-002]

**Files to touch**:

- `src/server/payload/migrations/backfillAdminTitle.ts` (NEW)

**Exact behavior**:

- Export an async function `backfillChapterAdminTitles(payload: Payload): Promise<{ updated: number; skipped: number; errors: number }>`
- Query all chapters where `adminTitle` is null, empty, or does not exist: `where: { or: [{ adminTitle: { equals: null } }, { adminTitle: { equals: '' } }, { adminTitle: { exists: false } }] }`
- For each chapter:
  - Fetch the related course by ID (chapter.course) to get `course.title`
  - Compute `adminTitle` as `"${chapter.title} — ${course.title}"` (or just `chapter.title` if course unavailable)
  - Update the chapter with `context: { skipAdminTitleRecompute: true }` to avoid triggering the `beforeChange` hook's redundant course lookup
- Return counts of updated/skipped/errors for logging
- Use `overrideAccess: true` and batch with `limit: 500` + pagination

**Tests** (`tests/int/chapter-admin-title.int.spec.ts` — add new test):

1. **Test: backfill fixes chapters with null adminTitle** — Create a chapter, manually set its `adminTitle` to null via direct DB update, run the backfill function, verify `adminTitle` is now correctly computed.

**Acceptance criteria**:

- [ ] `backfillChapterAdminTitles` function exists and is exported
- [ ] Running it on chapters with null `adminTitle` sets the correct combined title
- [ ] Running it on chapters that already have `adminTitle` does not modify them (skipped)
- [ ] Integration test passes
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

## Step 3: Wire Up Backfill as a Payload `onInit` Hook (Run-Once)

**Goal**: Ensure the backfill runs automatically on server startup so editors don't need to run a manual script. The backfill should be idempotent and skip chapters that already have `adminTitle`. [FR-002]

**Files to touch**:

- `src/server/payload/migrations/backfillAdminTitle.ts` (MODIFIED — add onInit wrapper)
- `src/server/payload/config/onInit.ts` OR `src/payload.config.ts` (MODIFIED — register onInit)

**Exact behavior**:

- In the Payload config's `onInit` callback (or an existing onInit file), call `backfillChapterAdminTitles(payload)`
- Log the result: `"Backfilled X chapter adminTitles (Y skipped, Z errors)"`
- If all chapters already have `adminTitle`, it does nothing (idempotent)
- This is a one-time migration that will naturally become a no-op once all chapters are backfilled

**Alternative**: If there is no existing `onInit` hook, add it directly to `payload.config.ts`:

```
onInit: async (payload) => {
  await backfillChapterAdminTitles(payload)
}
```

**Tests**:

1. **Test: backfill is idempotent** — Run backfill twice; second run should report 0 updated. (Can be combined with Step 2's test.)

**Acceptance criteria**:

- [ ] Backfill function is called on Payload init
- [ ] Running the server with all chapters already having `adminTitle` produces no updates
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

## Step 4: Add Integration Test for Dropdown Behavior with `select`

**Goal**: Verify the root cause is fixed — when Payload fetches chapters with `select: { adminTitle: true }` (simulating the admin dropdown), the `adminTitle` field is correctly populated from the DB, not computed on-the-fly. [FR-001, NFR-002]

**Files to touch**:

- `tests/int/chapter-admin-title.int.spec.ts` (MODIFIED)

**Exact behavior — new tests**:

1. **Test: "adminTitle survives select-only query (simulates dropdown)"**
   - Create a course and chapter (or use existing from beforeAll)
   - Verify chapter was created with `adminTitle` set (from `beforeChange` hook)
   - Query: `payload.find({ collection: 'chapters', where: { id: { equals: chapterId } }, select: { adminTitle: true }, depth: 0 })`
   - Assert: `doc.adminTitle` equals `"<chapter title> — <course title>"`
   - Assert: `doc.title` is `undefined` (confirming select stripped it)
   - Assert: `doc.course` is `undefined` (confirming select stripped it)

2. **Test: "two chapters with same title show different adminTitle in select-only query"**
   - Use the two chapters from beforeAll (both titled "Introduction" but in different courses)
   - Query both with `select: { adminTitle: true }`
   - Assert they have different `adminTitle` values
   - Assert each contains the respective course name

**Tests** (these ARE the deliverable):

- Test 1 verifies the fix — `adminTitle` is persisted in DB and survives `select` queries
- Test 2 verifies disambiguation — same chapter name, different courses → different labels

**Acceptance criteria**:

- [ ] Both new tests pass
- [ ] Tests specifically use `select: { adminTitle: true }` to simulate admin dropdown behavior
- [ ] No `afterRead` hook exists on chapters (verified by absence of import)
- [ ] All existing tests still pass: `pnpm vitest run tests/int/chapter-admin-title.int.spec.ts`
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

## Step 5: Final Verification & Cleanup

**Goal**: Ensure the entire feature works end-to-end and there are no regressions.

**Files to touch**:

- `src/server/payload/collections/Chapters.ts` (VERIFY — remove stale `console.log` on line 28 if desired)

**Checks**:

1. Run full integration test suite: `pnpm vitest run tests/int/chapter-admin-title.int.spec.ts`
2. Run TypeScript check: `pnpm tsc --noEmit`
3. Run lint: `pnpm lint`
4. Generate import map if needed: `pnpm generate:importmap`

**Acceptance criteria (all spec requirements)**:

- [ ] [FR-001] Chapter dropdown in Lesson admin shows `"<chapter title> — <course title>"` — verified by `useAsTitle: 'adminTitle'` + persisted `adminTitle` field
- [ ] [FR-002] Existing chapters get backfilled on init — verified by backfill migration test
- [ ] [FR-003] Label stays correct: chapter title change → `beforeChange` hook recomputes; course title change → `cascadeAdminTitle` hook updates all related chapters — verified by existing tests
- [ ] [NFR-001] Lesson data shape unchanged — verified by existing "lesson data shape unchanged" test
- [ ] [NFR-002] No N+1 at render time — `adminTitle` is a denormalized field read directly from DB; no course lookup needed at dropdown render time
- [ ] [NFR-003] Tenant safety — course title comes from the chapter's actual `course` relationship

---

## Assumptions

1. The `beforeChange` hook (`computeAdminTitle`) is working correctly and always sets `adminTitle` when chapters are created/updated — confirmed by passing tests.
2. The `cascadeAdminTitle` hook on courses is working correctly — confirmed by passing tests.
3. The only broken path was the `afterRead` hook which was meant as a backfill fallback but fails due to Payload's `select` optimization.
4. Payload's `useAsTitle` + `select` behavior is standard and won't change (it only fetches the `useAsTitle` field for dropdown options).
5. An `onInit` backfill is acceptable for this project's deployment model.

## Summary of Changes

| File                                                           | Action | Purpose                                |
| -------------------------------------------------------------- | ------ | -------------------------------------- |
| `src/server/payload/hooks/chapters/computeAdminTitleOnRead.ts` | DELETE | Remove broken afterRead hook           |
| `src/server/payload/collections/Chapters.ts`                   | MODIFY | Remove afterRead hook reference        |
| `src/server/payload/migrations/backfillAdminTitle.ts`          | NEW    | One-time backfill for legacy chapters  |
| `src/payload.config.ts` (or onInit file)                       | MODIFY | Wire backfill to run on init           |
| `tests/int/chapter-admin-title.int.spec.ts`                    | MODIFY | Add select-query tests + backfill test |
