# Plan: Teacher Profile Feature

**Task ID**: 260225-auto-93
**Type**: implement_feature
**Spec**: `.tasks/260225-auto-93/spec.md`

---

## Summary

Implement the Teacher Profile feature that defines the behavioral identity of the AI chat for student-facing requests. This involves:
1. A new `TeacherProfiles` collection
2. A new `UserSettings` collection (1:1 with Users)
3. An `afterChange` hook on Users to auto-create UserSettings on signup
4. A new `resolveTeacherProfile` service function
5. Injection of the teacher profile block into the system prompt composition pipeline
6. A seed function creating 5 Prompt entries + 5 TeacherProfile entries

---

## Assumptions

- The "Prompts" collection already has a `type` field with values `system` / `context`. Teacher profile prompts will use `type: 'context'` and a new `usage: 'teacher-profile'` value (no schema change needed for `type`, but `usage` already has `chat`/`extractor`/`verifier` — we'll add a `teacher-profile` option).
- The "configured default profile" mentioned in the spec will be resolved by slug `teacher_focused` (hardcoded constant). No ConfigValues entry needed for v1.
- The UI (Account → Teacher Profile tab, chat header label) is OUT OF SCOPE for this plan. The spec says "existing tab" — we assume the frontend will be a separate task. This plan covers backend + prompt injection only.
- `Prompts.usage` field will get a new option `teacher-profile` to distinguish teacher profile prompts from regular chat prompts.
- The `TeacherProfiles` collection does NOT need a `tenant` field since it's global content (all tenants share profiles). If multi-tenancy is needed later, it can be added.

---

## Step 1: Create `TeacherProfiles` Collection

**Time estimate**: 15 min

**Files to Touch**:
- `src/server/payload/collections/TeacherProfiles.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — add to collections array)

**Behavior**:
- New Payload collection with slug `teacher-profiles`
- Fields: `slug` (text, unique, indexed), `label` (text, required), `description` (textarea), `systemPrompt` (relationship to `prompts`, required), `isEnabled` (checkbox, defaultValue: true)
- Access: `read: authenticated`, `create: adminOnly`, `update: adminOnly`, `delete: adminOnly`
- Admin group: `AI`
- `useAsTitle: 'label'`
- Timestamps enabled

**Tests** (integration — `tests/int/teacher-profiles.int.spec.ts`):
1. **Admin can CRUD teacher profiles**: Create a profile with all fields, read it back, update it, delete it. Expects 200/success for all ops.
2. **Non-admin cannot create/update/delete**: Using a student user with `overrideAccess: false`, attempts to create/update/delete should fail (return empty results or throw).
3. **Authenticated user can read enabled profiles**: Student with `overrideAccess: false` can read profiles.
4. **Slug uniqueness enforced**: Creating two profiles with the same slug should throw a duplicate key error.

**Acceptance Criteria**:
- [x] Collection registered in `payload.config.ts`
- [x] `systemPrompt` is a relationship to `prompts`
- [x] Only admins can create/update/delete
- [x] Authenticated users can read
- [x] `slug` is unique and indexed

---

## Step 2: Create `UserSettings` Collection

**Time estimate**: 15 min

**Files to Touch**:
- `src/server/payload/collections/UserSettings.ts` (NEW)
- `src/server/payload/access/adminOrOwnerByUserField.ts` (NEW — reusable access for `user` field-based ownership)
- `src/payload.config.ts` (MODIFIED — add to collections array)

**Behavior**:
- New Payload collection with slug `user-settings`
- Fields: `user` (relationship to `users`, required, unique, index: true), `teacherProfile` (relationship to `teacher-profiles`, optional)
- Access:
  - `read`: admin full access OR user can read own record (query constraint: `{ user: { equals: user.id } }`)
  - `update`: admin full access OR user can update own record (same query constraint)
  - `create`: adminOnly (auto-created by hook, not user-facing)
  - `delete`: adminOnly
- Admin group: `Settings`
- Timestamps enabled

**New access function** `adminOrOwnerByUserField`:
```typescript
// Returns true for admins, or query constraint { user: { equals: user.id } } for others
```
This is distinct from `adminOrSelf` (which filters on `id: { equals: user.id }` for the Users collection). Here we filter on the `user` relationship field.

**Tests** (integration — `tests/int/user-settings.int.spec.ts`):
1. **Admin can CRUD user settings**: Create UserSettings for a user, read, update teacherProfile, delete.
2. **User can only read/update own settings**: Student A can read their settings but not Student B's. Student can update their own `teacherProfile` field.
3. **User field is unique**: Creating two UserSettings for the same user should throw duplicate error.
4. **teacherProfile is optional**: UserSettings can be created with `teacherProfile: null`.

**Acceptance Criteria**:
- [x] Collection registered in `payload.config.ts`
- [x] `user` field is unique and required
- [x] Users can only read/update their own settings
- [x] `teacherProfile` is optional relationship to `teacher-profiles`
- [x] Create/delete restricted to admin

---

## Step 3: Auto-Create UserSettings on User Creation

**Time estimate**: 15 min

**Files to Touch**:
- `src/server/payload/collections/Users/hooks/createUserSettings-hook.ts` (NEW)
- `src/server/payload/collections/Users/index.ts` (MODIFIED — add afterChange hook)

**Behavior**:
- `afterChange` hook on Users collection
- Only fires on `operation === 'create'`
- Creates a `user-settings` document with `user: doc.id` and `teacherProfile: null`
- Uses `req.payload.create` with `req` for transaction safety
- Wraps in try/catch — logs warning on failure but doesn't block user creation

**Tests** (integration — `tests/int/user-settings-auto-create.int.spec.ts`):
1. **UserSettings auto-created on user signup**: Create a new user → query `user-settings` where `user equals newUser.id` → expect exactly 1 doc with `teacherProfile: null`.
2. **Duplicate creation is idempotent**: If UserSettings already exists for a user (edge case), the hook should catch the duplicate error gracefully and not crash.

**Acceptance Criteria**:
- [x] Creating a user automatically creates a UserSettings record
- [x] `req` passed to nested create for transaction safety
- [x] Hook doesn't block user creation on failure
- [x] Only fires on `create` operation, not `update`

---

## Step 4: Add `teacher-profile` Usage Option to Prompts Collection

**Time estimate**: 10 min

**Files to Touch**:
- `src/server/payload/collections/Prompts.ts` (MODIFIED — add `teacher-profile` option to `usage` field)

**Behavior**:
- Add `{ label: 'Teacher Profile', value: 'teacher-profile' }` to the `usage` field options array
- This allows seed data and admin UI to distinguish teacher profile prompts from other types

**Tests** (unit — `tests/unit/collections/prompts-usage.test.ts`):
1. **`usage` field has teacher-profile option**: Import the Prompts collection config, find the `usage` field, verify it has a `teacher-profile` option.

**Acceptance Criteria**:
- [x] `Prompts.usage` field includes `teacher-profile` option
- [x] No breaking changes to existing usage values

---

## Step 5: Implement `resolveTeacherProfile` Service

**Time estimate**: 20 min

**Files to Touch**:
- `src/server/services/teacher-profile.ts` (NEW)

**Behavior**:
- Export `DEFAULT_TEACHER_PROFILE_SLUG = 'teacher_focused'`
- Export async function `resolveTeacherProfile(payload, userId?)`:
  1. If no userId (guest) → resolve default profile by slug
  2. If userId → load `user-settings` where `user equals userId` (overrideAccess: true)
  3. If settings exist and `teacherProfile` is set → load the `TeacherProfile` doc (depth 1 to populate `systemPrompt`)
  4. If profile exists, `isEnabled === true`, and `systemPrompt` is populated with a published prompt → return `{ profile, promptTemplate }`
  5. Else fallback to default profile (slug = `teacher_focused`, `isEnabled: true`)
  6. If default also missing/disabled → return `null` (graceful degradation)
- Return type: `{ label: string; description: string; promptTemplate: string } | null`

**Tests** (unit — `tests/unit/services/teacher-profile.test.ts`):
1. **Returns user's selected profile when valid**: Mock payload.find to return UserSettings with a valid, enabled profile. Expect the profile's label, description, and prompt template.
2. **Falls back to default when user has no selection**: Mock payload.find returning UserSettings with null teacherProfile. Expect fallback to `teacher_focused` profile.
3. **Falls back to default when selected profile is disabled**: UserSettings points to a disabled profile → expect fallback.
4. **Returns null when default profile is also missing**: No user selection, no default profile found → returns null.
5. **Guest user (no userId) resolves default profile**: Call with undefined userId → resolves default.

**Acceptance Criteria**:
- [x] Resolves user's selected teacher profile
- [x] Falls back to default profile (`teacher_focused`) when no selection or selection is disabled
- [x] Returns null when no profiles available (graceful degradation)
- [x] Uses `overrideAccess: true` for server-side lookups
- [x] Handles guest users by returning default

---

## Step 6: Inject Teacher Profile into System Prompt Composition

**Time estimate**: 25 min

**Files to Touch**:
- `src/infra/llm/prompt-composer.server.ts` (MODIFIED — add teacher profile block injection)
- `src/server/payload/endpoints/agent/chat/prompt-composition.ts` (MODIFIED — call resolveTeacherProfile and pass to composer)
- `src/server/payload/endpoints/agent/chat/pipeline.ts` (MODIFIED — pass userId to prompt composition)

**Behavior**:

The `composeSystemInstructions` function signature changes to accept an optional teacher profile:

```typescript
export function composeSystemInstructions(
  systemPrompts: string[],
  lessonPromptTemplate: string,
  lessonContextText?: string,
  teacherProfile?: { label: string; description: string; promptTemplate: string } | null,
): string
```

**Composition order** (per spec):
1. All published system prompts (joined with separator)
2. `<teacher_profile>` block (if resolved)
3. Lesson-specific resolved prompt + lesson context

The teacher profile block format:
```
<teacher_profile>
Name: {label}
Description: {description}

Behavior:
{promptTemplate}
</teacher_profile>
```

In `composeFullSystemInstructions`:
- Accept `userId?: string` parameter
- Call `resolveTeacherProfile(payload, userId)` 
- Pass result to `composeSystemInstructions`

In `pipeline.ts` and `chat.ts`:
- Pass `userId` (or undefined for guests) to `composeFullSystemInstructions`

**Critical rules from spec**:
- Append only — never replace base system prompt
- Inject BEFORE lesson context
- Do NOT pass this block into memory extraction (it's part of system instructions, not conversation messages — already correct by design since system instructions are not stored as messages)
- Do NOT include in vector search embedding (same — system instructions aren't embedded)
- Do NOT store as a chat message (same — it's composed at runtime)

**Tests** (unit — `tests/unit/lib/ai/prompt-composer-teacher-profile.test.ts`):
1. **Teacher profile block injected between system prompts and lesson prompt**: Call `composeSystemInstructions` with system prompts, lesson prompt, lesson context, and a teacher profile. Verify `<teacher_profile>` block appears after system prompts and before lesson prompt.
2. **Teacher profile block has correct format**: Verify the block contains `Name:`, `Description:`, `Behavior:` sections with correct values.
3. **No teacher profile block when null**: Call with `teacherProfile: null`. Verify no `<teacher_profile>` in output.
4. **No teacher profile block when undefined**: Call with no teacherProfile param. Verify no `<teacher_profile>` in output.
5. **Full composition order verified**: System prompts → teacher profile → lesson prompt → lesson context.

**Tests** (unit — `tests/unit/endpoints/prompt-composition-teacher-profile.test.ts`):
6. **composeFullSystemInstructions calls resolveTeacherProfile**: Mock `resolveTeacherProfile` and verify it's called with correct userId. Verify the result is passed to `composeSystemInstructions`.

**Acceptance Criteria**:
- [x] Teacher profile injected in correct order (after base system prompt, before lesson context)
- [x] Block uses `<teacher_profile>` XML-style delimiters
- [x] Block contains Name, Description, Behavior sections
- [x] Gracefully handles null/missing profile (no block injected)
- [x] Not stored in messages, memory, or vector search
- [x] Existing behavior unchanged when no teacher profile exists

---

## Step 7: Seed Teacher Profiles Data

**Time estimate**: 20 min

**Files to Touch**:
- `src/server/payload/endpoints/seed/teacher-profiles.ts` (NEW)
- `src/server/payload/endpoints/seed/index.ts` (MODIFIED — import and call `seedTeacherProfiles`)

**Behavior**:
- Create 5 Prompt entries with `type: 'context'`, `usage: 'teacher-profile'`, `status: 'published'`:
  - `teacher-strict-prompt`: Strict, no-nonsense tutor. Expects precision, corrects mistakes immediately.
  - `teacher-thorough-prompt`: Detailed explainer. Covers all edge cases, provides multiple examples.
  - `teacher-patient-prompt`: Patient, encouraging tutor. Repeats explanations, celebrates progress.
  - `teacher-focused-prompt` (default): Balanced tutor. Guides step-by-step, keeps focus on the problem.
  - `teacher-challenging-prompt`: Pushes students. Asks probing questions, raises difficulty.
- Create 5 TeacherProfile entries:
  - `teacher_strict` → label: "Strict Teacher", references strict prompt
  - `teacher_thorough` → label: "Thorough Teacher", references thorough prompt
  - `teacher_patient` → label: "Patient Teacher", references patient prompt
  - `teacher_focused` → label: "Focused Teacher" (default), references focused prompt
  - `teacher_challenging` → label: "Challenging Teacher", references challenging prompt
- All profiles have `isEnabled: true`
- Idempotent: check existence before creating (by slug)

**Tests** (integration — `tests/int/seed-teacher-profiles.int.spec.ts`):
1. **Seed creates 5 prompts and 5 profiles**: Run seedTeacherProfiles, query both collections, verify counts and slugs.
2. **Seed is idempotent**: Run twice, verify still exactly 5 of each.
3. **Default profile exists with slug teacher_focused**: Verify the default profile exists and is enabled.
4. **All profiles reference valid published prompts**: Each profile's `systemPrompt` resolves to a published prompt with non-empty template.

**Acceptance Criteria**:
- [x] 5 Prompt entries created with `usage: 'teacher-profile'`
- [x] 5 TeacherProfile entries created with correct slugs
- [x] All profiles are `isEnabled: true`
- [x] `teacher_focused` is the default profile
- [x] Seed is idempotent (safe to run multiple times)
- [x] Integrated into main seed function

---

## Step 8: Generate Types and Validate

**Time estimate**: 10 min

**Files to Touch**:
- `src/payload-types.ts` (AUTO-GENERATED)
- `src/app/(payload)/admin/importMap.js` (AUTO-GENERATED)

**Behavior**:
- Run `pnpm generate:types` to regenerate Payload types
- Run `pnpm generate:importmap` to update admin import map
- Run `pnpm -s tsc --noEmit` to validate no type errors
- Run `pnpm -s lint` to validate no lint errors

**Tests**:
1. **TypeScript compilation passes**: `tsc --noEmit` exits 0.
2. **All integration tests pass**: `pnpm test:int -- --grep "teacher-profile|user-settings"` exits 0.

**Acceptance Criteria**:
- [x] Types generated for TeacherProfiles and UserSettings
- [x] No TypeScript compilation errors
- [x] No lint errors
- [x] All new tests pass

---

## File Summary

| File | Status | Step |
|------|--------|------|
| `src/server/payload/collections/TeacherProfiles.ts` | NEW | 1 |
| `src/payload.config.ts` | MODIFIED | 1, 2 |
| `src/server/payload/collections/UserSettings.ts` | NEW | 2 |
| `src/server/payload/access/adminOrOwnerByUserField.ts` | NEW | 2 |
| `src/server/payload/collections/Users/hooks/createUserSettings-hook.ts` | NEW | 3 |
| `src/server/payload/collections/Users/index.ts` | MODIFIED | 3 |
| `src/server/payload/collections/Prompts.ts` | MODIFIED | 4 |
| `src/server/services/teacher-profile.ts` | NEW | 5 |
| `src/infra/llm/prompt-composer.server.ts` | MODIFIED | 6 |
| `src/server/payload/endpoints/agent/chat/prompt-composition.ts` | MODIFIED | 6 |
| `src/server/payload/endpoints/agent/chat/pipeline.ts` | MODIFIED | 6 |
| `src/server/payload/endpoints/agent/chat.ts` | MODIFIED | 6 |
| `src/server/payload/endpoints/seed/teacher-profiles.ts` | NEW | 7 |
| `src/server/payload/endpoints/seed/index.ts` | MODIFIED | 7 |
| `src/payload-types.ts` | AUTO-GENERATED | 8 |

## Test Summary

| Test File | Type | Step |
|-----------|------|------|
| `tests/int/teacher-profiles.int.spec.ts` | Integration | 1 |
| `tests/int/user-settings.int.spec.ts` | Integration | 2 |
| `tests/int/user-settings-auto-create.int.spec.ts` | Integration | 3 |
| `tests/unit/collections/prompts-usage.test.ts` | Unit | 4 |
| `tests/unit/services/teacher-profile.test.ts` | Unit | 5 |
| `tests/unit/lib/ai/prompt-composer-teacher-profile.test.ts` | Unit | 6 |
| `tests/int/seed-teacher-profiles.int.spec.ts` | Integration | 7 |

## Spec Requirements Traceability

| Spec Requirement | Plan Step |
|-----------------|-----------|
| TeacherProfiles collection exists | Step 1 |
| `systemPrompt` is relationship to Prompts | Step 1 |
| Only enabled profiles selectable/resolvable | Step 5 |
| UserSettings.teacherProfile works 1:1 | Step 2 |
| UserSettings auto-created on signup | Step 3 |
| Teacher Profile injected in correct system prompt order | Step 6 |
| Injection excluded from memory/vector pipelines | Step 6 (by design) |
| Switching profile changes behavior immediately | Step 5, 6 (runtime resolution) |
| Adaptive engine and other subsystems unaffected | Step 6 (scoped changes only) |
| Chat behaves as selected teacher identity | Step 6 |
| Seeding: 5 Prompts + 5 TeacherProfiles | Step 7 |
| Guest behavior: always use default profile | Step 5 |
