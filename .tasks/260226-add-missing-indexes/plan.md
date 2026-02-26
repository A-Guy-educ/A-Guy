# Plan: Add Missing Database Indexes

**Task ID**: 260226-add-missing-indexes
**Task Type**: refactor
**Estimated Total Time**: 20-30 minutes (2 steps)

## Assumptions

- All 10 fields identified in the spec currently lack `index: true`
- Adding `index: true` to Payload field definitions is a non-breaking, additive change
- MongoDB will create indexes on next startup/migration — no manual migration needed
- Posts `categories` field is nested inside a `tabs` > `Meta` tab (line 125 in `Posts/index.ts`)
- Posts `authors` field is a top-level field (line 186 in `Posts/index.ts`)
- No `clarified.md` exists; proceeding with spec as written

---

## Step 1: Add `index: true` to all 10 fields across 6 collection files

**Time**: 10-15 minutes

### Files to Touch

| # | File | Field | Line | Change |
|---|------|-------|------|--------|
| 1 | `src/server/payload/collections/Courses.ts` (MODIFIED) | `status` | ~108 | Add `index: true` |
| 2 | `src/server/payload/collections/Courses.ts` (MODIFIED) | `categories` | ~172 | Add `index: true` |
| 3 | `src/server/payload/collections/Chapters.ts` (MODIFIED) | `status` | ~106 | Add `index: true` |
| 4 | `src/server/payload/collections/Lessons.ts` (MODIFIED) | `status` | ~120 | Add `index: true` |
| 5 | `src/server/payload/collections/Tenants.ts` (MODIFIED) | `status` | ~37 | Add `index: true` |
| 6 | `src/server/payload/collections/Posts/index.ts` (MODIFIED) | `categories` | ~125 | Add `index: true` |
| 7 | `src/server/payload/collections/Posts/index.ts` (MODIFIED) | `authors` | ~186 | Add `index: true` |
| 8 | `src/server/payload/collections/Exercises/index.ts` (MODIFIED) | `sourceDoc` | ~177 | Add `index: true` |
| 9 | `src/server/payload/collections/ConfigAuditLogs.ts` (MODIFIED) | `tenant` | ~49 | Add `index: true` |
| 10 | `src/server/payload/collections/GuestSessions.ts` (MODIFIED) | `claimedByUser` | ~148 | Add `index: true` |

### Exact Behavior

For each field listed above, add the property `index: true` to the field definition object. The property should be placed alongside other top-level field properties (e.g., next to `required`, `type`, `name`), following the existing pattern seen in sibling fields that already have `index: true`.

**Example transformation** (Courses.ts `status` field, currently around line 108):

```typescript
// BEFORE
{
  name: 'status',
  type: 'select',
  required: true,
  defaultValue: 'draft',
  options: [ ... ],
  admin: { ... },
}

// AFTER
{
  name: 'status',
  type: 'select',
  required: true,
  defaultValue: 'draft',
  index: true,           // ← ADD THIS LINE
  options: [ ... ],
  admin: { ... },
}
```

**Note on Posts `categories`**: This field is nested inside a `tabs` field → second tab (`Meta`) → `fields` array → second field. The path is: `Posts.fields[1].tabs[1].fields[1]` (where `fields[1]` is the tabs field at the root). The `index: true` should be added to the field object at line ~125.

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/collections/collection-indexes.spec.ts` (NEW)

1. **Test: "status fields should be indexed in Courses, Chapters, Lessons, Tenants"**
   - Import collection configs from each file
   - For each collection, find the field with `name === 'status'`
   - Assert `field.index === true`
   - FAILS before: `status` fields don't have `index: true`
   - PASSES after: all 4 status fields have `index: true`

2. **Test: "relationship fields should be indexed in Courses, Posts, Exercises, ConfigAuditLogs, GuestSessions"**
   - Import collection configs
   - For Courses: find field `name === 'categories'`, assert `index === true`
   - For Posts: find the `categories` field inside tabs → Meta tab → fields, assert `index === true`
   - For Posts: find field `name === 'authors'`, assert `index === true`
   - For Exercises: find field `name === 'sourceDoc'` (inside tabs/groups), assert `index === true`
   - For ConfigAuditLogs: find field `name === 'tenant'`, assert `index === true`
   - For GuestSessions: find field `name === 'claimedByUser'`, assert `index === true`
   - FAILS before: none of these fields have `index: true`
   - PASSES after: all 6 relationship fields have `index: true`

### Acceptance Criteria

- [ ] `Courses.ts` `status` field has `index: true`
- [ ] `Courses.ts` `categories` field has `index: true`
- [ ] `Chapters.ts` `status` field has `index: true`
- [ ] `Lessons.ts` `status` field has `index: true`
- [ ] `Tenants.ts` `status` field has `index: true`
- [ ] `Posts/index.ts` `categories` field has `index: true`
- [ ] `Posts/index.ts` `authors` field has `index: true`
- [ ] `Exercises/index.ts` `sourceDoc` field has `index: true`
- [ ] `ConfigAuditLogs.ts` `tenant` field has `index: true`
- [ ] `GuestSessions.ts` `claimedByUser` field has `index: true`
- [ ] All unit tests in `tests/unit/collections/collection-indexes.spec.ts` pass

---

## Step 2: Verify TypeScript compilation and lint

**Time**: 5-10 minutes

### Files to Touch

None (verification only)

### Exact Behavior

Run the following commands to confirm no regressions:

```bash
pnpm tsc --noEmit          # TypeScript compilation
pnpm lint                   # Lint check
```

Both must pass with zero errors.

### Tests (FAIL before, PASS after)

No additional test file. The validation is:
1. `pnpm tsc --noEmit` exits with code 0
2. `pnpm lint` exits with code 0
3. Existing test suite passes: `pnpm vitest run tests/unit/collections/`

### Acceptance Criteria

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] No existing tests are broken

---

## Test Implementation Guide

The test file `tests/unit/collections/collection-indexes.spec.ts` needs a helper to find fields inside nested structures (tabs, groups). Here's the approach:

```typescript
import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'

// Helper: recursively find a field by name in a collection config
// Handles tabs, groups, rows, collapsibles, and arrays
function findFieldByName(fields: Field[], name: string): Field | undefined {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field
    // Check tabs
    if (field.type === 'tabs' && 'tabs' in field) {
      for (const tab of field.tabs) {
        const found = findFieldByName(tab.fields, name)
        if (found) return found
      }
    }
    // Check group/collapsible/row sub-fields
    if ('fields' in field && Array.isArray(field.fields)) {
      const found = findFieldByName(field.fields as Field[], name)
      if (found) return found
    }
  }
  return undefined
}
```

This recursive helper is needed because:
- Posts `categories` is nested inside `tabs > Meta > fields`
- Exercises `sourceDoc` is nested inside `tabs` or similar structures
- Other fields are at the root level

Import each collection config directly:
```typescript
import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'
import { Tenants } from '@/server/payload/collections/Tenants'
import { Posts } from '@/server/payload/collections/Posts/index'
import { Exercises } from '@/server/payload/collections/Exercises/index'
import { ConfigAuditLogs } from '@/server/payload/collections/ConfigAuditLogs'
import { GuestSessions } from '@/server/payload/collections/GuestSessions'
```

---

## Spec Requirement Traceability

| Spec Requirement | Plan Step | Test |
|---|---|---|
| Status fields indexed (4 collections) | Step 1, items 1-4 | Test 1: "status fields should be indexed" |
| Relationship fields indexed (6 collections) | Step 1, items 5-10 | Test 2: "relationship fields should be indexed" |
| TypeScript compilation passes | Step 2 | `pnpm tsc --noEmit` |
| No breaking changes | Step 2 | Existing test suite + lint |
| Follows existing patterns | Step 1 | Manual review; `index: true` placed consistently with existing indexed fields |
