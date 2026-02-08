# Codebase Fixes Plan — Staged by Priority & Effort

**Created**: 2026-02-07
**Total Stages**: 6
**Total Estimated Time**: ~6-8 hours
**Validation after each stage**: `pnpm tsc --noEmit && pnpm lint`

---

## Stage 1: Critical Security (P0) — ~30 min

### 1.1 Tighten CUD access on 9 content collections

**Why**: Any authenticated user (including students) can currently create/update/delete courses, chapters, lessons, categories, pricing plans, exercise assets, media, pages, and posts.

| #   | File                                               | Line(s)   | Change                                                                          |
| --- | -------------------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| 1a  | `src/server/payload/collections/Courses.ts`        | 13, 25-29 | Import `adminOnly`, replace `create/delete/update: authenticated` → `adminOnly` |
| 1b  | `src/server/payload/collections/Chapters.ts`       | 4, 16-20  | Same pattern                                                                    |
| 1c  | `src/server/payload/collections/Lessons.ts`        | 5, 16-20  | Same pattern                                                                    |
| 1d  | `src/server/payload/collections/Categories.ts`     | 4, 10-14  | Same pattern                                                                    |
| 1e  | `src/server/payload/collections/PricingPlans.ts`   | 4, 9-13   | Same pattern                                                                    |
| 1f  | `src/server/payload/collections/ExerciseAssets.ts` | 3, 8-12   | Same pattern                                                                    |
| 1g  | `src/server/payload/collections/Media/index.ts`    | 14, 23-27 | Same pattern                                                                    |
| 1h  | `src/server/payload/collections/Pages/index.ts`    | 6, 26-30  | Replace `authenticated` with `adminOnly` for create/delete/update               |
| 1i  | `src/server/payload/collections/Posts/index.ts`    | 12, 33-37 | Same pattern                                                                    |

**Pattern** (same for all 9):

```typescript
// Add import
import { adminOnly } from '../access/adminOnly'  // or '../../access/adminOnly'

// Change access
access: {
  create: adminOnly,   // was: authenticated
  delete: adminOnly,   // was: authenticated
  read: anyone,        // or authenticatedOrPublished — keep existing
  update: adminOnly,   // was: authenticated
}
```

**Note for Exercises** (`index.ts:48-52`): `create: authenticated` should also become `adminOnly`. The `update/delete: isAdminOrOwner` is fine.

### 1.2 Add `update` access to Header & Footer globals

| #   | File                          | Line(s)              | Change                                             |
| --- | ----------------------------- | -------------------- | -------------------------------------------------- |
| 2a  | `src/ui/web/header/config.ts` | 3 (add import), 8-10 | Add `import { adminOnly }` and `update: adminOnly` |
| 2b  | `src/ui/web/footer/config.ts` | 3 (add import), 8-10 | Same                                               |

```typescript
import { adminOnly } from '@/server/payload/access/adminOnly'

access: {
  read: () => true,
  update: adminOnly,  // NEW
}
```

### 1.3 Fix ExerciseAssets `staticDir` → remove upload config

| File                                               | Line(s) | Change                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/payload/collections/ExerciseAssets.ts` | 14-39   | Remove the entire `upload: { staticDir: 'exercise-assets', ... }` block. The Vercel Blob storage plugin (configured in `src/server/payload/plugins/index.ts`) will handle storage automatically, similar to how Media works. Add `upload: { mimeTypes: ['image/svg+xml', 'image/png'] }` to preserve the mime type restriction. |

**Verify**: The `vercelBlobStorage` plugin in `plugins/index.ts` already has an `exercise-assets` collection entry.

### Stage 1 Validation

```bash
pnpm tsc --noEmit && pnpm lint
```

---

## Stage 2: Performance — Database Indexes (P1) — ~10 min

### 2.1 Add `index: true` to `status` and `isActive` fields

| #    | File                 | Field             | Line | Change                            |
| ---- | -------------------- | ----------------- | ---- | --------------------------------- |
| 2.1a | `Courses.ts`         | `status`          | 102  | Add `index: true` to field config |
| 2.1b | `Courses.ts`         | `isActive`        | 124  | Add `index: true` to field config |
| 2.1c | `Courses.ts`         | `categories`      | 134  | Add `index: true` to field config |
| 2.1d | `Chapters.ts`        | `status`          | 93   | Add `index: true`                 |
| 2.1e | `Chapters.ts`        | `isActive`        | 115  | Add `index: true`                 |
| 2.1f | `Lessons.ts`         | `status`          | 116  | Add `index: true`                 |
| 2.1g | `Lessons.ts`         | `isActive`        | 138  | Add `index: true`                 |
| 2.1h | `Exercises/index.ts` | `order`           | 77   | Add `index: true`                 |
| 2.1i | `Exercises/index.ts` | `contentHash`     | 181  | Add `index: true`                 |
| 2.1j | `Exercises/index.ts` | `conversionJobId` | 161  | Add `index: true`                 |
| 2.1k | `PricingPlans.ts`    | `isActive`        | 149  | Add `index: true`                 |

### Stage 2 Validation

```bash
pnpm tsc --noEmit
```

---

## Stage 3: Security Hardening — Field-Level & Data Protection (P1) — ~20 min

### 3.1 Hide sensitive User fields from API mutation

| #    | File             | Field                | Line    | Change                                                       |
| ---- | ---------------- | -------------------- | ------- | ------------------------------------------------------------ |
| 3.1a | `Users/index.ts` | `googleSub`          | 69-78   | Add `access: { read: adminOnly_field, update: () => false }` |
| 3.1b | `Users/index.ts` | `verifiedEmail`      | 80-85   | Add `access: { update: () => false }`                        |
| 3.1c | `Users/index.ts` | `registrationMethod` | 87-97   | Add `access: { update: () => false }`                        |
| 3.1d | `Users/index.ts` | `registeredAt`       | 99-103  | Add `access: { update: () => false }`                        |
| 3.1e | `Users/index.ts` | `googleProfile`      | 105-112 | Add `access: { update: () => false }`                        |

```typescript
// For googleSub — restrict both read and update
access: {
  read: ({ req: { user } }) => {
    return isUsersCollectionUser(user) && user.role === AccountRole.Admin
  },
  update: () => false,
}

// For all others — just lock update
access: {
  update: () => false,
}
```

### 3.2 Hide `embedding` vector from MemoryItems API responses

| File             | Line    | Change                                                                                                                                     |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MemoryItems.ts` | 145-160 | Add `access: { read: ({ req }) => req.user?.role === AccountRole.Admin }` to the `embedding` field. Saves ~12KB per item in API responses. |

### Stage 3 Validation

```bash
pnpm tsc --noEmit && pnpm lint
```

---

## Stage 4: Code Quality — Deduplication & Bug Fixes (P2) — ~1.5 hours

### 4.1 Extract shared revalidation utility

**Create**: `src/server/payload/utils/revalidation.ts`

```typescript
export async function safeRevalidatePath(path: string): Promise<void> {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(path)
  } catch (error) {
    console.warn('Failed to revalidate path:', error)
  }
}

export async function safeRevalidateTag(tag: string): Promise<void> {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(tag)
  } catch (error) {
    console.warn('Failed to revalidate tag:', error)
  }
}
```

**Then update these 5 files** to use the shared utility:

- `src/server/payload/collections/Posts/hooks/revalidatePost.ts` (L6-14)
- `src/server/payload/collections/Pages/hooks/revalidatePage.ts` (L6-14)
- `src/server/payload/hooks/revalidateRedirects.ts` (L4-12)
- `src/ui/web/header/hooks/revalidateHeader.ts` (L4-12)
- `src/ui/web/footer/hooks/revalidateFooter.ts` (L4-12)

### 4.2 Add missing `context.disableRevalidate` guard

| File                                              | Line | Change                                                                                                                                                                         |
| ------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/payload/hooks/revalidateRedirects.ts` | 14   | Add `context` to destructured args, add `if (!context.disableRevalidate)` guard around the revalidation call (matching pattern in `revalidatePost.ts` and `revalidatePage.ts`) |

### 4.3 Fix `key={index}` on ChatInterface messages

| File                                      | Line | Change                                                                                      |
| ----------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `src/ui/web/chat/ChatInterface/index.tsx` | 245  | Change `key={idx}` to `key={msg.id ?? \`\${msg.role}-\${idx}\`}` or use a stable message ID |

### 4.4 Add missing `response.ok` check after fetch

| File                                               | Line    | Change                                                                                                                 |
| -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/server/payload/jobs/pdf-to-exercises-task.ts` | 633-634 | Add `if (!response.ok) throw new Error(\`Failed to fetch image: \${response.status}\`)`after the`fetch(imageUrl)` call |

### 4.5 Convert `SignupFormFields.css` to Tailwind

| File                                             | Change                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(frontend)/signup/SignupFormFields.css` | Delete this file                                                                                                                        |
| `src/app/(frontend)/signup/SignupFormFields.tsx` | Remove CSS import (L4), replace the honeypot `className` with Tailwind: `className="absolute -left-[9999px] w-px h-px overflow-hidden"` |

### 4.6 Extract shared `trimMessagesForUpdate`

**Create**: `src/server/payload/endpoints/agent/chat/utils.ts`

Extract the `trimMessagesForUpdate` function from both:

- `src/server/payload/endpoints/agent/chat.ts` (L66-80)
- `src/server/payload/endpoints/agent/chat/pipeline.ts` (L38-53)

Update both files to import from the shared util.

### Stage 4 Validation

```bash
pnpm tsc --noEmit && pnpm lint
```

---

## Stage 5: Admin UX Polish (P2) — ~30 min

### 5.1 Add `useAsTitle` to collections missing it

| #    | File                | Change                                                       |
| ---- | ------------------- | ------------------------------------------------------------ |
| 5.1a | `ExerciseAssets.ts` | Add `admin: { useAsTitle: 'alt' }` after L6                  |
| 5.1b | `PricingPlans.ts`   | Add `useAsTitle: 'provider'` to existing `admin` block (L15) |
| 5.1c | `Media/index.ts`    | Add `useAsTitle: 'filename'` to `admin` section              |

### 5.2 Add `admin.group` to all collections

| Collection                                                          | Group         |
| ------------------------------------------------------------------- | ------------- |
| Courses, Chapters, Lessons, Exercises, ExerciseAssets, Categories   | `Content`     |
| Pages, Posts, Media                                                 | `Website`     |
| Users, UserProgress                                                 | `Users`       |
| PricingPlans                                                        | `Commerce`    |
| Conversations, MemoryItems, Prompts                                 | `Chat System` |
| ConfigValues, ConfigSecrets, ConfigAuditLogs, MCPAuditLogs, Tenants | `System`      |

Add `admin: { group: 'GroupName' }` to each collection's `admin` config.

### 5.3 Add `filterOptions` to relationship fields

| #    | File                 | Field           | filterOptions                                                        |
| ---- | -------------------- | --------------- | -------------------------------------------------------------------- |
| 5.3a | `Chapters.ts`        | `course` (L40)  | `{ status: { equals: 'published' }, isActive: { equals: true } }`    |
| 5.3b | `Lessons.ts`         | `chapter` (L55) | `{ status: { not_equals: 'archived' }, isActive: { equals: true } }` |
| 5.3c | `Exercises/index.ts` | `lesson` (L85)  | `{ status: { not_equals: 'archived' }, isActive: { equals: true } }` |
| 5.3d | `PricingPlans.ts`    | `lesson` (L29)  | `{ status: { not_equals: 'archived' } }`                             |
| 5.3e | `Courses.ts`         | `prompt` (L144) | `{ status: { equals: 'published' } }`                                |
| 5.3f | `Lessons.ts`         | `prompt` (L177) | `{ status: { equals: 'published' } }`                                |

### 5.4 Add `admin.description` to undocumented collections

| File                | Description to add                                                  |
| ------------------- | ------------------------------------------------------------------- |
| `Categories.ts`     | `'Content categories for courses and posts'`                        |
| `ExerciseAssets.ts` | `'SVG and PNG assets used within exercise content blocks'`          |
| `Media/index.ts`    | `'All media files stored via Vercel Blob'`                          |
| `UserProgress.ts`   | `'Tracks student progress across chapters, lessons, and exercises'` |
| `PricingPlans.ts`   | `'Payment plans linking lessons to payment providers'`              |
| `MCPAuditLogs.ts`   | `'Append-only audit log for MCP tool invocations'`                  |

### 5.5 Add explicit `labels` to underscore-slug collections

| File                 | Slug                | Labels                                                          |
| -------------------- | ------------------- | --------------------------------------------------------------- |
| `MemoryItems.ts`     | `memory_items`      | `{ singular: 'Memory Item', plural: 'Memory Items' }`           |
| `ConfigValues.ts`    | `config_values`     | `{ singular: 'Config Value', plural: 'Config Values' }`         |
| `ConfigSecrets.ts`   | `config_secrets`    | `{ singular: 'Config Secret', plural: 'Config Secrets' }`       |
| `ConfigAuditLogs.ts` | `config_audit_logs` | `{ singular: 'Config Audit Log', plural: 'Config Audit Logs' }` |

### 5.6 Improve `defaultColumns`

| File             | Current                          | Improved                                                  |
| ---------------- | -------------------------------- | --------------------------------------------------------- |
| `Posts/index.ts` | `['title', 'slug', 'updatedAt']` | `['title', 'authors', 'categories', 'slug', 'updatedAt']` |
| `Pages/index.ts` | `['title', 'slug', 'updatedAt']` | `['title', 'slug', '_status', 'updatedAt']`               |

### Stage 5 Validation

```bash
pnpm tsc --noEmit && pnpm lint && pnpm generate:importmap
```

---

## Stage 6: Housekeeping (P3) — ~2-3 hours

### 6.1 Remove unused files

| #    | File                                     | Reason                        |
| ---- | ---------------------------------------- | ----------------------------- |
| 6.1a | `src/ui/web/ExampleForm.tsx`             | Not imported anywhere         |
| 6.1b | `src/ui/web/CommandPalette.tsx`          | Not imported anywhere         |
| 6.1c | `src/app/api/example/route.ts`           | Demo endpoint, not referenced |
| 6.1d | `src/ui/web/shared/Loading/Spinner.tsx`  | Not imported anywhere         |
| 6.1e | `src/ui/web/shared/Loading/Skeleton.tsx` | Not imported anywhere         |
| 6.1f | `temp/` directory                        | Contains only `.DS_Store`     |

### 6.2 Move misplaced test file

| From                                       | To                                                |
| ------------------------------------------ | ------------------------------------------------- |
| `src/infra/utils/PayloadRedirects.test.ts` | `tests/unit/infra/utils/PayloadRedirects.test.ts` |

### 6.3 Remove `console.log` from production API routes

Priority files (direct production impact):
| # | File | Lines | Action |
|---|---|---|---|
| 6.3a | `src/app/api/jobs/run-immediate/route.ts` | 99, 102, 104, 132 | Replace with `payload.logger.info(...)` or remove |
| 6.3b | `src/server/payload/jobs/pdf-to-exercises-task.ts` | 135, 154 | Replace with `payload.logger.info(...)` |

### 6.4 Replace `logger as any` casts in chat endpoint

| File                                         | Lines                   | Action                                                                                                                             |
| -------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/payload/endpoints/agent/chat.ts` | 420, 492, 500, 510, 530 | Fix the logger type — either widen the function signature or create a `ChatLogger` type alias that matches the actual logger shape |

### 6.5 Fix stubbed enrollment check (TODO in production code)

| File                                          | Lines    | Action                                                                                                                                         |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/services/conversation-service.ts` | 248, 263 | Either implement real enrollment check or add explicit comment documenting it as intentionally permissive, and convert TODO to a tracked issue |

### 6.6 Add versions to Prompts collection

| File                                        | Change                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/server/payload/collections/Prompts.ts` | Add `versions: { drafts: true, maxPerDoc: 50 }` — prompts are critical AI config, need rollback capability |

### Stage 6 Validation

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test:unit
```

---

## Post-Implementation Checklist

After all stages are complete:

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm format` passes (run `pnpm format:fix` if needed)
- [ ] `pnpm generate:types` regenerates types
- [ ] `pnpm generate:importmap` regenerates import map
- [ ] `pnpm test:unit` passes
- [ ] `pnpm test:int` passes (if CI available)
- [ ] Manual smoke test: admin panel loads, collections are grouped, relationship pickers filter correctly

---

## Progress Tracking

| Stage                         | Status | Date Completed | Notes |
| ----------------------------- | ------ | -------------- | ----- |
| Stage 1: Critical Security    | TODO   | -              |       |
| Stage 2: Performance Indexes  | TODO   | -              |       |
| Stage 3: Field-Level Security | TODO   | -              |       |
| Stage 4: Code Quality         | TODO   | -              |       |
| Stage 5: Admin UX Polish      | TODO   | -              |       |
| Stage 6: Housekeeping         | TODO   | -              |       |
