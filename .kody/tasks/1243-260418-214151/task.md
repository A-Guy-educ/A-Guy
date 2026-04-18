# feat(LMS): Enrollments collection + self-service enrollment UI


## Context

Currently, the platform has no formal enrollment system. Course access is managed implicitly through `Users.courseEntitlements` (an array on the User document) with three grant methods: `admin`, `payment`, and `code`. There is no way for students to browse courses and self-enroll, no enrollment approval workflows, and no enrollment records that can be audited.

This is a **P0 blocker** for making this a complete LMS — enrollment is the fundamental relationship between a student and a course.

## What Is Missing

1. **No `Enrollments` Payload collection** — there is no record of who enrolled in what course and when
2. **No self-service enrollment UI** — students cannot browse and enroll; only admins can grant entitlements
3. **No enrollment request/approval workflow** — no way to request access and have it approved
4. **No enrollment expiry/renewal** — entitlements are permanent
5. **No waitlist** — when a course is full, no waitlist mechanism exists
6. **No prerequisite enforcement** — students can access any course regardless of prior completion
7. **No cohort/group enrollment** — cannot enroll an entire class at once
8. **No enrollment history/audit log** — no record of when enrollments changed

## Implementation Approach (Payload-First)

### Step 1: Create the `Enrollments` Payload Collection

**File:** `src/server/payload/collections/Enrollments.ts`

```typescript
import type { CollectionConfig } from "payload"

export const Enrollments: CollectionConfig = {
  slug: "enrollments",
  admin: { defaultSort: "-createdAt", useAsTitle: "id" },
  hooks: {
    beforeChange: [({ data }) => {
      if (!data.enrolledAt) data.enrolledAt = new Date().toISOString()
      return data
    }],
  },
  fields: [
    { name: "user", type: "relationship", relationTo: "users", required: true },
    { name: "course", type: "relationship", relationTo: "courses", required: true },
    {
      name: "status", type: "select", defaultValue: "active", required: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Waitlisted", value: "waitlisted" },
      ],
    },
    {
      name: "enrollmentType", type: "select", required: true,
      options: [
        { label: "Admin Grant", value: "admin" },
        { label: "Payment", value: "payment" },
        { label: "Access Code", value: "code" },
        { label: "Prerequisite Unlock", value: "prerequisite" },
      ],
    },
    { name: "enrolledAt", type: "date", admin: { readOnly: true } },
    { name: "expiresAt", type: "date" },
    { name: "approvedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
    { name: "notes", type: "textarea" },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === "admin") return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => user?.role === "admin",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
}
```

### Step 2: Enrollment Access Check Hook

**File:** `src/server/payload/hooks/enrollment/accessCheck.ts`

```typescript
export const hasActiveEnrollment = async (req, userId: string, courseId: string) => {
  const { payload } = req
  const enrollment = await payload.find({
    collection: "enrollments",
    where: { user: { equals: userId }, course: { equals: courseId }, status: { equals: "active" } },
    limit: 1,
  })
  return enrollment.docs.length > 0
}
```

### Step 3: Cron Job for Expiry

**File:** `src/server/payload/hooks/enrollment/expireEnrollments.ts`

```typescript
export const expireEnrollments = async () => {
  await payload.update({
    collection: "enrollments",
    where: { status: { equals: "active" }, expiresAt: { less_than: new Date().toISOString() } },
    data: { status: "expired" },
  })
}
```

### Step 4: API Routes

- `src/app/api/enrollments/route.ts` — List/create enrollments
- `src/app/api/enrollments/[id]/route.ts` — Get/update/cancel enrollment
- `src/app/api/enrollments/request/route.ts` — Student requests enrollment

### Step 5: Frontend Pages

- `src/app/(frontend)/enrollments/page.tsx` — Student enrollment dashboard
- `src/app/(frontend)/courses/[courseSlug]/_components/EnrollButton.tsx` — Enroll CTA

## Files to Create

| File | Action |
|---|---|
| `src/server/payload/collections/Enrollments.ts` | Create |
| `src/server/payload/hooks/enrollment/accessCheck.ts` | Create |
| `src/server/payload/hooks/enrollment/expireEnrollments.ts` | Create |
| `src/app/api/enrollments/route.ts` | Create |
| `src/app/api/enrollments/[id]/route.ts` | Create |
| `src/app/api/enrollments/request/route.ts` | Create |
| `src/app/(frontend)/enrollments/page.tsx` | Create |
| `src/app/(frontend)/courses/[courseSlug]/_components/EnrollButton.tsx` | Create |

## Acceptance Criteria

- [ ] `Enrollments` collection exists and is accessible in Payload admin
- [ ] Students can browse courses and request enrollment
- [ ] Admins can approve/reject enrollment requests
- [ ] Enrollments expire correctly when `expiresAt` is set
- [ ] Active enrollment is enforced before accessing course content
- [ ] Enrollment history is auditable in Payload admin
- [ ] `courseEntitlements` is migrated and deprecated

---

## Test Strategy

### Unit Tests (`tests/unit/enrollment/`)
Pure functions. Fast, no DB, no HTTP.

```
hasActiveEnrollment() returns true when active enrollment exists
hasActiveEnrollment() returns false when enrollment is expired
hasActiveEnrollment() returns false when enrollment is cancelled
expireEnrollments() marks correct records as expired
expireEnrollments() does not affect already-expired records
enrollmentStatus transitions: pending → active, active → expired, active → cancelled
```

### Integration Tests (`tests/int/enrollment/`)
API routes + DB via Payload test API. No HTTP client.

```
POST /api/enrollments/request → creates pending enrollment
GET /api/enrollments → student sees only their own enrollments
GET /api/enrollments → admin sees all enrollments
PATCH /api/enrollments/[id] → admin approves → status changes to active
PATCH /api/enrollments/[id] → admin cancels → status changes to cancelled
DELETE /api/enrollments/[id] → admin deletes enrollment
```

### E2E Tests (`tests/e2e/lms-enrollments.e2e.spec.ts`)
Critical browser journeys only.

```
student can request enrollment and see it in my enrollments page
student with cancelled enrollment cannot access course page
```

### Helper
`tests/e2e/helpers/enrollments.ts`
```ts
async function seedEnrollment(payload, userId: string, courseId: string, status = 'active')
```


---

## Discussion (54 comments)

*Showing first 5 and last 10 of 54 comments*

**@aguyaharonyair** (2026-04-16):

@kody

Execute this issue. This is a **P0 LMS feature** — build the Enrollments Payload collection + self-service enrollment UI.

Key constraints:
- Use **Payload-first** approach: Payload collections, access control, hooks, and admin UI
- The implementation plan is fully detailed in the issue body above
- This does NOT depend on other P0 issues — run in parallel with #1244, #1245, and the notifications collection part of #1247
- After completion, wire enrollment confirmation into the Email System (#1245) and Stripe webhook (#1246) once those are ready
- See the Files to Create table and Acceptance Criteria at the bottom of the issue body


**@aguyaharonyair** (2026-04-16):


## Test Scenarios for This Feature

Add E2E tests to `tests/e2e/lms-enrollments.e2e.spec.ts` using the existing Playwright + auth helpers pattern.

**Helper to create:** `tests/e2e/helpers/enrollments.ts`
```ts
async function seedEnrollment(payload, userId: string, courseId: string, status = 'active')
async function getEnrollment(payload, userId: string, courseId: string)
```

**Test scenarios (student journey):**
1. `student can request enrollment from course page`
2. `student can view enrollment status in my enrollments page`
3. `enrollment expires automatically when expiresAt passes`
4. `cancelled enrollment blocks course access`

**Test scenarios (admin journey):**
5. `admin can see all enrollments in Payload admin`
6. `admin can approve a pending enrollment`
7. `admin can cancel an enrollment`
8. `admin can set enrollment expiry date`

**Helper:** Use `seedTestCourseData()` from `helpers/courses.ts` + `createTestUser()` from `helpers/auth.ts`
**Cleanup:** Delete enrollments in `afterAll` using `payload.delete()`


**@aguyaharonyair** (2026-04-18):
@kody

Execute this issue. Build the Enrollments Payload collection + self-service enrollment UI as described in the issue body.

- Payload-first approach: create the `Enrollments` collection, access check hook, and expiry cron
- Add API routes and frontend pages per the Files to Create table
- Include unit, integration, and E2E tests per the Test Strategy section
- Acceptance criteria are in the issue body

**@aguyaharonyair** (2026-04-18):
🚀 Kody pipeline started: `Execute` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24603522588))

**@aguyaharonyair** (2026-04-18):
❌ Pipeline crashed: Invalid model spec 'MiniMax-M2.7-highspeed' — expected 'provider/model' (e.g. 'claude/claude-sonnet-4-6', 'minimax/MiniMax-M2.7-highspeed')

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
@kody rerun --from build

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-18):
🚀 Kody pipeline started: `1243-260418-214151` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24614202534))

