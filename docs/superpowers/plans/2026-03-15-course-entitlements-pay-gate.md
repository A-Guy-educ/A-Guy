# Course Entitlements & Pay-Gate Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-enforced pay-gate for courses and lessons, with admin ability to grant entitlements to users.

**Architecture:** New `UserEntitlements` Payload collection linking users to courses/lessons. New `paid` access type added to existing access type system. Server-side entitlement check before serving content. Frontend gate modal for unauthenticated/unauthorized users.

**Tech Stack:** Payload CMS collections, Next.js server components, React hooks, existing access control patterns.

---

## Chunk 1: Data Layer

### Task 1: Add `paid` to access type constants

**Files:**
- Modify: `src/infra/auth/access-types.ts`

- [ ] **Step 1: Add `paid` to ACCESS_TYPES**

```typescript
export const ACCESS_TYPES = ['free', 'mandatory', 'gated', 'paid'] as const
```

- [ ] **Step 2: Add `paid` option to LESSON_ACCESS_TYPES**

Already derived from ACCESS_TYPES via spread, so this is automatic.

- [ ] **Step 3: Update `resolveAccessType` — no changes needed**

The function already handles any valid AccessType. `paid` will flow through as-is.

- [ ] **Step 4: Commit**

```bash
git add src/infra/auth/access-types.ts
git commit -m "feat: Add paid access type" -m "Add paid to ACCESS_TYPES for server-enforced entitlement gating."
```

---

### Task 2: Add `paid` option to Course and Lesson collection configs

**Files:**
- Modify: `src/server/payload/collections/Courses.ts`
- Modify: `src/server/payload/collections/Lessons.ts`

- [ ] **Step 1: Add paid option to Courses.ts accessType and pageAccessType fields**

Add `{ label: 'Paid (Requires Entitlement)', value: 'paid' }` to both select fields' options arrays.

- [ ] **Step 2: Add paid option to Lessons.ts accessType field**

Add `{ label: 'Paid (Requires Entitlement)', value: 'paid' }` to the options array.

- [ ] **Step 3: Run `pnpm generate:types` to update payload-types.ts**

- [ ] **Step 4: Commit**

```bash
git add src/server/payload/collections/Courses.ts src/server/payload/collections/Lessons.ts src/payload-types.ts
git commit -m "feat: Add paid option to course and lesson access types" -m "Courses and lessons can now be marked as paid, requiring entitlements."
```

---

### Task 3: Create `UserEntitlements` collection

**Files:**
- Create: `src/server/payload/collections/UserEntitlements.ts`
- Modify: `src/payload.config.ts` (register collection)

- [ ] **Step 1: Create the collection config**

```typescript
// src/server/payload/collections/UserEntitlements.ts
import type { CollectionConfig } from 'payload'
import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../access/adminOnly'
import { authenticatedOrOwner } from '../access/authenticatedOrOwner'
import { createdByField } from '../fields/createdBy'

export const UserEntitlements: CollectionConfig = {
  slug: 'user-entitlements',
  admin: {
    useAsTitle: 'grantMethod',
    defaultColumns: ['user', 'contentType', 'course', 'lesson', 'grantMethod', 'createdAt'],
    description: 'Manage user access to paid courses and lessons',
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: authenticatedOrOwner,
  },
  fields: [
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'The student who has access' },
    },
    {
      name: 'contentType',
      type: 'select',
      required: true,
      options: [
        { label: 'Course', value: 'course' },
        { label: 'Lesson', value: 'lesson' },
      ],
      admin: { description: 'Whether this entitlement is for a course or a specific lesson' },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      index: true,
      admin: {
        description: 'The course to grant access to',
        condition: (data) => data?.contentType === 'course',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      index: true,
      admin: {
        description: 'The specific lesson to grant access to',
        condition: (data) => data?.contentType === 'lesson',
      },
    },
    {
      name: 'grantMethod',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Admin Grant', value: 'admin' },
        { label: 'Payment', value: 'payment' },
        { label: 'Access Code', value: 'code' },
      ],
      admin: { description: 'How this entitlement was granted' },
    },
    {
      name: 'grantedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'The admin who granted this entitlement (if admin grant)',
        condition: (data) => data?.grantMethod === 'admin',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: { description: 'Optional expiration date (leave empty for permanent access)' },
    },
    createdByField,
  ],
}
```

- [ ] **Step 2: Register in payload.config.ts**

Add import and add to collections array.

- [ ] **Step 3: Run `pnpm generate:types` and `pnpm generate:importmap`**

- [ ] **Step 4: Commit**

```bash
git add src/server/payload/collections/UserEntitlements.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat: Add UserEntitlements collection" -m "New collection for tracking user access to paid courses and lessons."
```

---

## Chunk 2: Server-Side Enforcement

### Task 4: Create entitlement check service

**Files:**
- Create: `src/server/services/entitlements/entitlement_check.ts`

- [ ] **Step 1: Create the entitlement check function**

```typescript
// src/server/services/entitlements/entitlement_check.ts
import type { Payload } from 'payload'

interface CheckEntitlementParams {
  payload: Payload
  userId: string
  courseId?: string
  lessonId?: string
}

/**
 * Check if a user has an entitlement for a course or lesson.
 * - Course entitlement covers all lessons in that course.
 * - Lesson entitlement covers only that specific lesson.
 */
export async function hasEntitlement({
  payload,
  userId,
  courseId,
  lessonId,
}: CheckEntitlementParams): Promise<boolean> {
  const now = new Date().toISOString()
  const conditions: Record<string, unknown>[] = []

  // Check course-level entitlement
  if (courseId) {
    conditions.push({
      and: [
        { user: { equals: userId } },
        { contentType: { equals: 'course' } },
        { course: { equals: courseId } },
      ],
    })
  }

  // Check lesson-level entitlement
  if (lessonId) {
    conditions.push({
      and: [
        { user: { equals: userId } },
        { contentType: { equals: 'lesson' } },
        { lesson: { equals: lessonId } },
      ],
    })
  }

  if (conditions.length === 0) return false

  const result = await payload.find({
    collection: 'user-entitlements',
    where: {
      and: [
        { or: conditions },
        {
          or: [
            { expiresAt: { exists: false } },
            { expiresAt: { greater_than: now } },
          ],
        },
      ],
    },
    limit: 1,
    depth: 0,
  })

  return result.totalDocs > 0
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/entitlements/entitlement_check.ts
git commit -m "feat: Add entitlement check service" -m "Server-side function to verify user has access to paid content."
```

---

### Task 5: Create entitlement check API endpoint

**Files:**
- Create: `src/app/api/entitlements/entitlement_check/route.ts`

- [ ] **Step 1: Create the API route**

GET `/api/entitlements/check?courseId=X` or `?lessonId=X`
Returns `{ hasAccess: boolean }`.
Requires authentication (401 if not logged in).

- [ ] **Step 2: Commit**

```bash
git add src/app/api/entitlements/entitlement_check/route.ts
git commit -m "feat: Add entitlement check API endpoint" -m "GET endpoint for client to verify user access to paid content."
```

---

### Task 6: Enforce entitlements on lesson page

**Files:**
- Modify: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`

- [ ] **Step 1: Add entitlement check to lesson page server component**

After resolving accessType, if it's `paid`:
1. Check if user is authenticated (via payload.auth)
2. If not authenticated → pass `requiresEntitlement: true` to client
3. If authenticated → call `hasEntitlement()` with courseId and lessonId
4. If no entitlement → pass `requiresEntitlement: true` to client
5. If entitled → render content normally

- [ ] **Step 2: Commit**

```bash
git add "src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx"
git commit -m "feat: Enforce entitlements on lesson page" -m "Server-side check blocks paid content for users without entitlements."
```

---

## Chunk 3: Frontend Gate

### Task 7: Add `paid` case to useAccessGate hook

**Files:**
- Modify: `src/client/hooks/useAccessGate.ts`

- [ ] **Step 1: Add `requiresEntitlement` param and `showPaidModal` return**

Add a new param `requiresEntitlement?: boolean` (passed from server component).
When `accessType === 'paid'` and `requiresEntitlement` is true, return `showPaidModal: true`.

- [ ] **Step 2: Commit**

```bash
git add src/client/hooks/useAccessGate.ts
git commit -m "feat: Add paid access type to useAccessGate hook" -m "Hook now handles paid content with entitlement-based gating."
```

---

### Task 8: Create PaidContentModal component

**Files:**
- Create: `src/client/components/access-gate/PaidContentModal.tsx`

- [ ] **Step 1: Create the modal component**

Simple modal that says "This content requires a purchase" with course/lesson info.
For the demo, just a clean message — no purchase button (no payment integration yet).
If user is not logged in, show login prompt. If logged in but no entitlement, show "contact admin" message.

- [ ] **Step 2: Add translations to messages/en.json and messages/he.json**

Keys under `accessGate.paid.*`:
- `title`: "Premium Content"
- `messageLoggedOut`: "Please sign in to access this content."
- `messageNoEntitlement`: "This content requires a purchase. Please contact your administrator."

- [ ] **Step 3: Wire the modal into the lesson page**

Use `showPaidModal` from `useAccessGate` to conditionally render the modal instead of content.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/access-gate/PaidContentModal.tsx messages/en.json messages/he.json
git commit -m "feat: Add PaidContentModal for paid content gating" -m "Modal displayed when user lacks entitlement for paid content."
```

---

## Chunk 4: API Response Updates

### Task 9: Update by-grade API to include `paid` access type info

**Files:**
- Modify: `src/app/api/chapters/by-grade/route.ts`

- [ ] **Step 1: No code changes needed**

The `coursePageAccessType` is already passed through from the course document. Since we added `paid` to the access type options, it will flow through automatically.

- [ ] **Step 2: Verify by reading the route and confirming the field pass-through**

---

### Task 10: Final verification

- [ ] **Step 1: Run `pnpm generate:types`**
- [ ] **Step 2: Run `pnpm typecheck`**
- [ ] **Step 3: Run `pnpm lint`**
- [ ] **Step 4: Fix any issues**
- [ ] **Step 5: Test manually: set a course to `paid`, verify content is blocked, grant entitlement via admin, verify access**
