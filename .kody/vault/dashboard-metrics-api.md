---
title: Dashboard Metrics API
type: component
updated: 2026-05-04
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1374
---

## Overview

`GET /api/admin/dashboard-metrics` returns aggregated metrics for the admin dashboard: user registrations, active sessions, course enrollments, and content counts. Route file: `src/app/api/admin/dashboard-metrics/route.ts`.

## Course Enrollment Bug (PR #1374)

**Symptom**: The course enrollments section only displayed one course.

**Root cause**: `ent.course` could be a MongoDB ObjectId instance — it has `toString()` but no `.id` property. The original code did `String(ent.course)` which produced `"[object Object]"` for ObjectId instances, causing all enrollments to collapse into a single bucket.

**Fix**: `extractCourseId(course)` helper — three-branch type handler:

1. **String** → return as-is
2. **Object with `id` property** → return `obj.id` (plain populated refs)
3. **Object with `toString()` but no `id`** → parse `ObjectId('...')` pattern via regex; fall back to raw `toString()` if no match

```ts
export function extractCourseId(course: unknown): string | null {
  if (course === undefined || course === null) return null
  if (typeof course === 'string') return course
  if (typeof course === 'object' && 'id' in course) return String(course.id) || null
  if (typeof (course as any).toString === 'function') {
    const match = String(course).match(/ObjectId\(['"]?([^'")]+)['"]?\)/)
    if (match) return match[1]
  }
  return null
}
```

Unit tests: `tests/unit/api/extract-course-id.test.ts`
Integration test: `tests/int/dashboard-metrics.int.spec.ts`

## Admin User Creation Pattern

Integration tests that need an admin user must use the **create-then-update** pattern because the `Users` collection `beforeChange` hook strips `role: Admin` on initial create. Only `payload.update` with `overrideAccess: true` can set the admin role.

```ts
// Create as default (role = student via hook)
const user = await payload.create({ collection: 'users', data: { email, password, name } })
// Promote via update (bypasses hook)
await payload.update({ collection: 'users', id: user.id, data: { role: AccountRole.Admin }, overrideAccess: true })
```

This pattern is documented in `tests/int/access-codes.int.spec.ts` as the canonical example.

## Response Shape (guarded by tests)

```ts
interface UserMetrics {
  activeUsersToday: number
  activeUsersYesterday: number
  registeredYesterday: number
  registeredThisWeek: number
  registeredLastWeek: number      // new — needed by RegisteredUsersCard
  registeredThisMonth: number
  registeredLastMonth: number     // new — needed by RegisteredUsersCard
  totalUsers: number
  // ...
}
```

`registeredLastWeek` and `registeredLastMonth` were added to the query response to support trend calculations in the redesigned user metrics card (see [admin-dashboard](./admin-dashboard.md)).

## Related

- [admin-dashboard](./admin-dashboard.md)
