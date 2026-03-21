# Teacher Profile – Chat Identity Implementation Plan (v1.1)

## Context

The chat **is the teacher**. Currently, the AI chat uses a single behavioral identity for all users. This feature makes it configurable per-user via Teacher Profiles — each linked to a Prompt entry — that get injected into the system context on every request. The account settings already have a placeholder tab (`teachers-profile`) ready for the UI.

**Scope:** TeacherProfiles collection, UserSettings (1:1), seed data, resolver with prompt injection, Account UI selection, chat header label, PR.

---

## Phase 1: Data Layer

### 1.1 Create `TeacherProfiles` collection

**New file:** `src/server/payload/collections/TeacherProfiles.ts`

| Field | Type | Notes |
|-------|------|-------|
| `slug` | text | `unique: true`, `index: true`, required |
| `label` | text | required, `useAsTitle` |
| `description` | textarea | short UI explanation (1-2 sentences) |
| `systemPrompt` | relationship → `prompts` | **required** (no text-field alternative) |
| `isEnabled` | checkbox | `defaultValue: true`, `index: true` |

- Access: `adminOnly` for all CRUD. Pipeline reads use `overrideAccess: true`.
- Admin group: `'AI'` (alongside Prompts)
- `timestamps: true`
- No `tenantField` in v1.1 — avoids "no profiles found" bugs from tenant mismatch. Can be added later if multi-tenant filtering is needed.

### 1.2 Create `UserSettings` collection

**New file:** `src/server/payload/collections/UserSettings/index.ts`

| Field | Type | Notes |
|-------|------|-------|
| `user` | relationship → `users` | required, `unique: true` (1:1), `index: true`, `readOnly` in admin |
| `teacherProfile` | relationship → `teacher_profiles` | optional (null = use default) |

- Access: read/update → `authenticatedOrOwner` (reuse `src/server/payload/access/authenticatedOrOwner.ts`), create/delete → `adminOnly`
- `timestamps: true`
- If a selected profile becomes disabled (`isEnabled: false`), the DB value stays unchanged. Fallback is handled at runtime by the resolver.

### 1.3 Register in Payload config

**Modify:** `src/payload.config.ts`
- Import and add `TeacherProfiles` and `UserSettings` to the collections array

### 1.4 Auto-create UserSettings on user signup

**New file:** `src/server/payload/collections/Users/hooks/createUserSettings-hook.ts`

`afterChange` hook on Users collection:
- Runs only when `operation === 'create'`
- Creates `user_settings` record: `{ user: doc.id }` (teacherProfile left null)
- Passes `req` for transaction safety
- Logs error but does NOT fail user creation

**Modify:** `src/server/payload/collections/Users/index.ts`
- Add `createUserSettings` to `hooks.afterChange` (after `auditRoleChange`)

### 1.5 Lazy creation for existing users

No `onInit` backfill. Existing users without a `user_settings` record are handled by:
- Resolver: Tier 1 returns null → falls through to default
- API PATCH route: creates the record if missing (lazy creation on first profile selection)

### 1.6 Generate types

Run `pnpm generate:types` → produces `TeacherProfile` and `UserSetting` types in `src/payload-types.ts`

---

## Phase 2: Teacher Profile Resolution Service

**New file:** `src/server/services/teacher-profile-resolver.ts`

### Default profile slug — hardcoded constant for v1.1

```typescript
export const DEFAULT_TEACHER_PROFILE_SLUG = 'teacher_focused'
```

This is a hardcoded constant. Changing the default requires a code change + PR.

### Resolution strategy (authenticated users)

1. **Tier 1:** Load `UserSettings.teacherProfile` for this user (depth 2 to populate profile → systemPrompt). If exists AND `isEnabled === true` AND prompt `status === 'published'` AND `template` is non-empty → use it.
2. **Tier 2:** Query `teacher_profiles` where `slug === DEFAULT_TEACHER_PROFILE_SLUG` AND `isEnabled === true`. Populate systemPrompt. If found AND prompt published + non-empty → use it.
3. **Tier 3:** Query first `teacher_profiles` where `isEnabled === true`, `sort: 'createdAt'`, limit 1. If found → use it.
4. **Tier 4:** Hardcoded `FAILSAFE_TEACHER_PROMPT` string. Never throws.

### Resolution strategy (guests)

Guests have no userId → skip Tier 1 and Tier 3:
- **Tier 2:** Default profile by slug only.
- **Tier 4:** If default is missing/disabled → hardcoded failsafe + log warning. **No Tier 3** for guests — a random profile would be confusing.

### Per-request resolution

Called on **every chat request** inside `composeFullSystemInstructions()`. No caching, no snapshot. Switching profile affects the very next message.

### Resolver query strategy

Use `depth: 1` (populate profile's systemPrompt one level) with `select` to fetch only needed fields:
- From TeacherProfile: `slug`, `label`, `description`, `isEnabled`, `systemPrompt`
- From Prompt (populated): `template`, `status`

This avoids over-fetching and keeps the resolver fast.

### Prompt validation in resolver

When evaluating a profile's prompt (confirmed from `src/server/payload/collections/Prompts.ts`):
- `prompt.status === 'published'` (exact enum: `'draft' | 'published' | 'archived'`)
- `prompt.template` is non-empty after trim (field is `required: true` in schema, but guard defensively)
- If either check fails, skip this tier

### Return type

```typescript
interface ResolvedTeacherProfile {
  profileSlug: string
  profileLabel: string
  profileDescription: string
  promptTemplate: string
  resolvedFrom: 'user-settings' | 'default-config' | 'first-active' | 'failsafe'
}
```

---

## Phase 3: System Prompt Injection

### 3.1 Teacher profile block builder

**New file:** `src/infra/llm/teacher-profile-block.ts`

Builds the `<teacher_profile>` block per spec:

```
<teacher_profile>
Name: {label}
Description: {description}

Behavior:
{systemPrompt.template text}
</teacher_profile>
```

Exports `buildTeacherProfileBlock(input)` function.

### 3.2 Modify prompt composer

**Modify:** `src/infra/llm/prompt-composer.server.ts`

Add optional `teacherProfileBlock?: string` parameter to `composeSystemInstructions()`.

**Strict injection order:**
1. Base system prompts (joined with separator)
2. **`<teacher_profile>` block** ← NEW
3. Lesson/course prompt template
4. Lesson/course context text

Comment: teacher profile block is part of system role, NOT stored in `conversation.messages`, never enters memory extraction or embedding.

### 3.3 Modify `composeFullSystemInstructions`

**Modify:** `src/server/payload/endpoints/agent/chat/prompt-composition.ts`

- Add `userId?: string` parameter
- Import `resolveTeacherProfile` and `buildTeacherProfileBlock`
- Call resolver (per-request), build block, pass to `composeSystemInstructions()`
- Log: `{ teacherProfileSlug, resolvedFrom }`

### 3.4 Thread `userId` through call sites

Two call sites:

1. **`src/server/payload/endpoints/agent/chat/pipeline.ts`** (line ~225)
   - Pass `req.user?.id`

2. **`src/server/payload/endpoints/agent/chat.ts`** (line ~677, `handleContextScopedChat`)
   - Pass `userId`

Streaming endpoint uses `runChatPipeline()` → gets the change automatically.
Admin chat (`handleAdminModeChat`) is unaffected — not in scope.

---

## Phase 4: Seed Data

**New file:** `src/server/payload/seed/teacher-profiles-seed.ts`

Creates 5 Prompt entries + 5 TeacherProfile entries. Idempotent (checks by `key`/`slug`).

| Slug | Label | Prompt Key |
|------|-------|------------|
| `teacher_strict` | Strict Teacher | `teacher-strict-v1` |
| `teacher_thorough` | Thorough Teacher | `teacher-thorough-v1` |
| `teacher_patient` | Patient Teacher | `teacher-patient-v1` |
| `teacher_focused` | Focused Teacher (default) | `teacher-focused-v1` |
| `teacher_challenging` | Challenging Teacher | `teacher-challenging-v1` |

Prompt entries seeded with exact enum values from `src/server/payload/collections/Prompts.ts`:
- `type: 'context'` (NOT `'system'` — `'system'` prompts are auto-included by `fetchPublishedSystemPrompts`)
  - Exact options: `'system' | 'context'`
- `status: 'published'` (only `'published'` used at runtime)
  - Exact options: `'draft' | 'published' | 'archived'`
- `usage: 'chat'`
  - Exact options: `'chat' | 'extractor' | 'verifier'`
- `template: '...'` (non-empty prompt text, field is `required: true`)
- `isDefaultForAgentChat: false`

All profiles: `isEnabled: true`.

**Modify:** `src/payload.config.ts` — call `seedTeacherProfiles(payload)` in `onInit` after `runBackfillOnInit`. Idempotent — safe to re-run.

---

## Phase 5: API Routes

### 5.1 List active teacher profiles

**New file:** `src/app/(frontend)/api/teacher-profiles/route.ts`

`GET` — auth-first pattern:
1. Call `payload.auth({ headers })` → if no user, return `401` immediately
2. Only after auth succeeds: query `teacher_profiles` where `isEnabled === true`, sorted by `label`
3. Use `overrideAccess: true` (collection is `adminOnly`, server-side read is safe after auth check)
4. Use `select: { slug: true, label: true, description: true, isEnabled: true }` — **never return `systemPrompt` or prompt `template`**
5. Map response to `{ profiles: [{ slug, label, description }] }`

### 5.2 User settings

**New file:** `src/app/(frontend)/api/user-settings/route.ts`

`GET` — auth-first pattern:
1. Call `payload.auth({ headers })` → if no user, return `401` immediately
2. Query `user_settings` where `user === userId`, depth 1 to populate `teacherProfile`
3. Use `overrideAccess: true` after auth check (safe: we already verified the user)
4. Shape response: `{ settings: { id, teacherProfile: { slug, label, description } | null } }` — **no systemPrompt/template**

`PATCH` — auth-first pattern:
1. Call `payload.auth({ headers })` → if no user, return `401` immediately
2. Zod-validate body: `{ teacherProfileSlug: z.string() }`
3. Verify profile exists and `isEnabled === true` via query with `overrideAccess: true`
4. Find or create (lazy) `user_settings` record for this user
5. Update with new `teacherProfile` ID
6. Return `{ success: true }`

---

## Phase 6: Frontend UI

### 6.1 Account → Teacher Profile tab

**Modify:** `src/app/(frontend)/account/_components/TeachersProfileSection.tsx`

Replace placeholder with:
- Fetch active profiles + current selection on mount (parallel requests)
- Grid of `Card` components showing label + short description
- Selected card: `ring-2 ring-primary` + `Badge` "Selected"
- Click → `PATCH /api/user-settings` → `toast.success()` / `toast.error()`
- Immediate save on click (no explicit save button)

### 6.2 Chat header label

**Modify:** `src/ui/web/chat/ChatInterface/index.tsx`

- Authenticated users only: fetch teacher profile label from `/api/user-settings` on mount
- Small `Badge` at top of chat area with profile label
- Guests: no badge

### 6.3 Translations

**Modify:** `src/i18n/en.json` — add keys under `auth.account.teacherProfile`:
- `description`, `loading`, `selected`, `changeSuccess`, `changeFailed`, `noProfiles`

**Modify:** `src/i18n/he.json` — Hebrew equivalents

---

## Files Summary

### New files (8)
| File | Purpose |
|------|---------|
| `src/server/payload/collections/TeacherProfiles.ts` | Collection definition |
| `src/server/payload/collections/UserSettings/index.ts` | Collection definition |
| `src/server/payload/collections/Users/hooks/createUserSettings-hook.ts` | Auto-create on signup |
| `src/server/services/teacher-profile-resolver.ts` | Resolution (4-tier auth, 2-tier guest) |
| `src/infra/llm/teacher-profile-block.ts` | `<teacher_profile>` block builder |
| `src/server/payload/seed/teacher-profiles-seed.ts` | Seed 5 prompts + 5 profiles |
| `src/app/(frontend)/api/teacher-profiles/route.ts` | GET active profiles (auth required) |
| `src/app/(frontend)/api/user-settings/route.ts` | GET/PATCH user settings |

### Modified files (9)
| File | Change |
|------|--------|
| `src/payload.config.ts` | Register 2 collections + seed in onInit |
| `src/server/payload/collections/Users/index.ts` | Add createUserSettings hook |
| `src/infra/llm/prompt-composer.server.ts` | Add teacherProfileBlock param |
| `src/server/payload/endpoints/agent/chat/prompt-composition.ts` | Add userId, resolve profile |
| `src/server/payload/endpoints/agent/chat/pipeline.ts` | Pass userId |
| `src/server/payload/endpoints/agent/chat.ts` | Pass userId in handleContextScopedChat |
| `src/app/(frontend)/account/_components/TeachersProfileSection.tsx` | Replace placeholder |
| `src/ui/web/chat/ChatInterface/index.tsx` | Add teacher profile badge |
| `src/i18n/en.json` + `src/i18n/he.json` | Translation keys |

### Reused utilities
| Utility | Path |
|---------|------|
| `adminOnly` | `src/server/payload/access/adminOnly.ts` |
| `authenticatedOrOwner` | `src/server/payload/access/authenticatedOrOwner.ts` |
| `toast` (Sonner) | `import { toast } from 'sonner'` |
| `Card`, `Badge` | `src/ui/web/components/` |
| `useTranslations` | `src/ui/web/providers/I18n` |

---

## Verification

1. `pnpm dev` → admin panel shows TeacherProfiles (AI group) and UserSettings with 5 seeded profiles
2. `/account?section=teachers-profile` → cards render, click saves, toast confirms
3. Send chat message → server logs show `Resolved teacher profile` with slug + resolvedFrom
4. Change profile → next message uses new profile (verify in logs)
5. Guest (incognito) → uses default `teacher_focused` profile
6. Deactivate default in admin → guest falls to failsafe (warning logged)
7. Deactivate user's selected profile → falls to default on next message
8. Verify `/api/teacher-profiles` returns 401 for unauthenticated requests
9. Verify no `systemPrompt`/`template` fields in API responses
10. `pnpm ci:local` passes
