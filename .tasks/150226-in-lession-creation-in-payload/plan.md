## Plan: `150226-in-lession-creation-in-payload`

### Summary

The goal is to make the Payload Admin's chapter relationship dropdown (on the Lesson edit page) show `"<chapter title> — <course title>"` instead of just `"<chapter title>"`.

**Strategy (per clarification answer #1A):** Add a denormalized `adminTitle` text field to the `chapters` collection, set `admin.useAsTitle: 'adminTitle'`, and maintain it via hooks:

- **Chapter `beforeChange` hook**: computes `adminTitle` when a chapter is created/updated
- **Course `afterChange` hook**: when a course title changes, batch-updates all related chapters' `adminTitle`

**Key clarification-driven decisions:**

- **No backfill script** (user answer #5: "no backfill") — existing chapters will get the new label only when next saved, or when their parent course is updated. This is an accepted deviation from FR-002.
- **No i18n** (answer #2A: single locale)
- **Em dash separator** (answer #3A): `"Chapter Title — Course Title"`
- **Multi-tenant via `tenant` field** (answer #4B) — hooks must be tenant-safe
- **Eventual consistency** (answer #6B): course title changes update chapters asynchronously (though in practice the `afterChange` hook runs synchronously within the request)

---

### Step 1: Add `adminTitle` field to Chapters collection & update `useAsTitle`

**Time estimate:** 10–15 minutes

**Files to touch:**

- `src/server/payload/collections/Chapters.ts` (MODIFIED, lines ~14, ~33, ~36-37)

**Exact behavior:**

- Add a new `adminTitle` field of `type: 'text'` to the Chapters collection, positioned after the `title` field
- The field is optional (`required: false`), not indexed (only used for display), and hidden from admin edit form (`admin.hidden: true`) since it's auto-computed
- Change `admin.useAsTitle` from `'title'` to `'adminTitle'`
- This causes Payload to use the `adminTitle` field value as the label in all relationship dropdowns that reference `chapters`

**WHY:** Payload's `useAsTitle` determines what's shown in relationship dropdowns. By pointing it to a denormalized field that combines chapter + course title, we get the desired display without custom UI components. This is the same pattern that would be used for any "computed display name" in Payload — it's the simplest, most stable approach (answer #1A).

**Similar patterns:** The codebase already uses `useAsTitle` in every collection (e.g., `Courses.ts:42`, `Chapters.ts:33`, `Users/index.ts:32`). The `createdByField` in `src/server/payload/fields/createdBy.ts` shows the pattern of using hooks on fields.

**Tests (FAIL before, PASS after):**

1. **Test: `adminTitle` field exists on chapters schema**

   ```
   // tests/int/chapter-admin-title.int.spec.ts
   // Create a chapter → expect doc to have `adminTitle` property
   // Before: field doesn't exist, doc has no adminTitle
   // After: field exists, doc has adminTitle (initially empty/null until hook runs)
   ```

2. **Test: `useAsTitle` points to `adminTitle`**
   ```
   // Import Chapters config, verify admin.useAsTitle === 'adminTitle'
   // Before: useAsTitle === 'title'
   // After: useAsTitle === 'adminTitle'
   ```

**Acceptance criteria:**

- [ ] `Chapters` collection has an `adminTitle` field of type `text`
- [ ] `adminTitle` is hidden from the admin edit form (`admin.hidden: true`)
- [ ] `admin.useAsTitle` is `'adminTitle'`
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

### Step 2: Add `beforeChange` hook to Chapters to compute `adminTitle`

**Time estimate:** 15–20 minutes

**Files to touch:**

- `src/server/payload/hooks/chapters/computeAdminTitle.ts` (NEW)
- `src/server/payload/collections/Chapters.ts` (MODIFIED, hooks section ~lines 23-31)

**Exact behavior:**

- Create a new hook file at `src/server/payload/hooks/chapters/computeAdminTitle.ts`
- The hook runs on both `create` and `update` operations
- It fetches the related course (using `data.course` or `originalDoc.course`) via `req.payload.findByID` with `depth: 0` and `overrideAccess: true`
- Computes: `data.adminTitle = courseTitle ? \`${chapterTitle} — ${courseTitle}\` : chapterTitle`
- Passes `req` for transaction safety
- Falls back to just `chapterTitle` if course lookup fails or course has no title (FR-001 fallback requirement)
- Register this hook in the Chapters collection `hooks.beforeChange` array (alongside the existing slug hook)

**WHY `beforeChange` not `afterChange`:** We want the computed value written to the document in the same save operation. `beforeChange` lets us modify `data` before it's persisted. The existing slug generation hook already uses this exact pattern (Chapters.ts lines 23-29).

**Tests (FAIL before, PASS after):**

1. **Test: Creating a chapter computes `adminTitle` with course name**

   ```
   // Create a course with title "Math 101"
   // Create a chapter with title "Algebra" in that course
   // Expect chapter.adminTitle === "Algebra — Math 101"
   // Before: no hook, adminTitle is null/empty
   // After: hook computes the combined label
   ```

2. **Test: Fallback when course has no title (edge case)**
   ```
   // Create a chapter where the course lookup returns no title
   // Expect chapter.adminTitle === "Chapter Title" (fallback)
   // Before: no hook, adminTitle is null
   // After: hook falls back gracefully
   ```

**Acceptance criteria:**

- [ ] Creating a chapter with `title: "Algebra"` under course `"Math 101"` sets `adminTitle` to `"Algebra — Math 101"`
- [ ] Updating a chapter's title recomputes `adminTitle`
- [ ] Changing a chapter's `course` relationship recomputes `adminTitle`
- [ ] The hook passes `req` to nested payload operations (transaction safety)
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

### Step 3: Add `afterChange` hook to Courses to cascade title changes to chapters

**Time estimate:** 15–20 minutes

**Files to touch:**

- `src/server/payload/hooks/courses/cascadeAdminTitle.ts` (NEW)
- `src/server/payload/collections/Courses.ts` (MODIFIED, hooks section ~lines 31-39)

**Exact behavior:**

- Create a new hook file at `src/server/payload/hooks/courses/cascadeAdminTitle.ts`
- The hook runs on `update` operations only (new courses have no chapters yet)
- Compares `doc.title` with `previousDoc.title` — if unchanged, skip (performance guard per NFR-002)
- If title changed:
  1. Query all chapters where `course equals doc.id` using `req.payload.find({ collection: 'chapters', where: { course: { equals: doc.id } }, depth: 0, overrideAccess: true, req })`
  2. For each chapter, update `adminTitle` to `"${chapter.title} — ${doc.title}"` using `req.payload.update({ ..., context: { skipAdminTitleRecompute: true }, req })`
  3. The context flag prevents the Chapter `beforeChange` hook from doing a redundant course lookup during this batch update
- Register in `Courses` collection `hooks.afterChange` array

**WHY `afterChange` not `beforeChange`:** We need the course document to be saved first (with its new title) before updating related chapters. The course title is already finalized by `afterChange`. This matches the pattern used in `Users/hooks/auditRoleChange-hook.ts` and `Pages/index.ts:122`.

**WHY batch is OK for NFR-002:** This queries chapters once with a single `find` query (not per-option), and updates are only triggered when a course title actually changes — not on every page load of the lesson admin.

**Tests (FAIL before, PASS after):**

1. **Test: Updating a course title cascades to chapter `adminTitle`**

   ```
   // Create course "Math 101" → create chapter "Algebra" → adminTitle is "Algebra — Math 101"
   // Update course title to "Advanced Math"
   // Re-read chapter → expect adminTitle === "Algebra — Advanced Math"
   // Before: no cascade hook, adminTitle stays "Algebra — Math 101"
   // After: cascade updates it
   ```

2. **Test: Updating a course's non-title field does NOT cascade**
   ```
   // Create course + chapter
   // Update course description (not title)
   // Verify chapter adminTitle unchanged (performance check)
   // This tests the guard condition
   ```

**Acceptance criteria:**

- [ ] Changing a course title updates `adminTitle` on all its chapters
- [ ] Non-title course updates do NOT trigger chapter updates
- [ ] The hook passes `req` to all nested operations
- [ ] Uses `context` flag to prevent redundant course lookups in the chapter `beforeChange` hook
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

### Step 4: Integration test — full round-trip in Lesson admin context

**Time estimate:** 15–20 minutes

**Files to touch:**

- `tests/int/chapter-admin-title.int.spec.ts` (NEW — consolidates all tests from steps 1-3 plus these additional scenarios)

**Exact behavior:**
This step creates the comprehensive integration test file that validates the entire feature end-to-end. Tests from steps 1-3 are written here; this step adds the **disambiguation** and **data shape** tests.

**Tests (FAIL before, PASS after):**

1. **Test: Two chapters with same title but different courses are disambiguated (FR-001)**

   ```
   // Create course "Math" and course "Science"
   // Create chapter "Introduction" in "Math" → adminTitle "Introduction — Math"
   // Create chapter "Introduction" in "Science" → adminTitle "Introduction — Science"
   // Assert the two adminTitles are different
   ```

2. **Test: Lesson data shape unchanged after feature (NFR-001)**
   ```
   // Create course → chapter → lesson
   // Verify lesson.chapter is a string ID (or populated object with id)
   // Verify no new fields on lesson document
   // This proves we haven't changed lesson data semantics
   ```

**Acceptance criteria:**

- [ ] Two chapters named "Introduction" in different courses have distinct `adminTitle` values
- [ ] Lesson `chapter` field still stores a chapter ID (no format change)
- [ ] All tests pass: `pnpm exec vitest run tests/int/chapter-admin-title.int.spec.ts`

---

### Step 5: Generate types and run quality gates

**Time estimate:** 5–10 minutes

**Files to touch:**

- `src/payload-types.ts` (AUTO-GENERATED)
- Import map regenerated

**Exact behavior:**

1. Run `pnpm generate:types` — updates `payload-types.ts` to include `adminTitle` on the `Chapter` type
2. Run `pnpm generate:importmap` — regenerate admin import map
3. Run `pnpm tsc --noEmit` — verify no type errors
4. Run `pnpm lint` — verify no lint errors
5. Run full test suite — verify no regressions

**Tests:**

- All existing tests still pass (regression check)
- `tests/int/chapter-admin-title.int.spec.ts` passes

**Acceptance criteria:**

- [ ] `payload-types.ts` includes `adminTitle?: string | null` on the `Chapter` interface
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:int` passes (no regressions)

---

### Spec Requirements Coverage Matrix

| Requirement                                          | Step(s)                             | Test(s)                                                                       |
| ---------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| **FR-001**: Dropdown shows `"<chapter> — <course>"`  | Steps 1, 2                          | "Creating a chapter computes adminTitle with course name"                     |
| **FR-002**: Existing chapters show label immediately | **Skipped per user: "no backfill"** | N/A — documented assumption                                                   |
| **FR-003**: Label stays correct over time            | Steps 2, 3                          | "Updating chapter title recomputes", "Course title cascades"                  |
| **NFR-001**: No lesson data shape change             | Step 1 (useAsTitle only)            | "Lesson data shape unchanged"                                                 |
| **NFR-002**: No N+1 per-option queries               | Steps 1, 3                          | By design: denormalized field, no runtime query per option                    |
| **NFR-003**: Tenant safety                           | Steps 2, 3                          | Hooks use existing data relationships (course→chapter); no cross-tenant reads |

### Documented Assumptions

1. **No backfill** (user answer #5): Existing chapters will get the combined label only when they are next saved (either directly or when their course title changes). This means FR-002 is partially unmet until all chapters are touched.
2. **Lesson `chapter` field** (user answer #7 "not sure"): Confirmed from code — `lessons.chapter` is a single relationship to `chapters` (Lessons.ts line 55-62).
3. **`adminTitle` hidden from edit form**: Since it's auto-computed, editors shouldn't manually edit it. Setting `admin.hidden: true` keeps the admin form clean.

---
