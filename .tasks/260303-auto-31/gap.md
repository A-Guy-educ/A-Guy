# Gap Analysis: 260303-auto-31

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Existing `authenticatedOrPublished` uses wrong field

**Severity:** Critical
**Location:** `src/server/payload/access/authenticatedOrPublished.ts`
**Issue:** The existing `authenticatedOrPublished` helper uses `_status` (Payload's built-in drafts field), but Courses/Chapters/Lessons use a custom `status` field (select: draft/published/archived). This makes the existing helper incompatible with the collections being modified.
**Fix Applied:** Spec already acknowledges this in FR-005 ("Implement or refactor an access helper...must filter on the collections' **custom** `status` field (not Payload's `_status` drafts field)"). The spec is correct - new helper required.

### Gap 2: Collections currently use `anyone` access (no security)

**Severity:** Critical
**Location:** `src/server/payload/collections/Courses.ts`, `Chapters.ts`, `Lessons.ts`
**Issue:** All three collections currently use `read: anyone` which allows unrestricted public access. The spec requires authenticated users to see all content while anonymous users should only see `status='published'` AND `isActive=true`.
**Fix Applied:** Added NFR-001 explicitly stating this security requirement. Updated FR-001/FR-002/FR-003 to specify exact access control changes needed.

### Gap 3: Hierarchy visibility invariant not enforced

**Severity:** High
**Location:** Query repos and collection access control
**Issue:** The spec requires chapters under non-public courses and lessons under non-public chapters/courses to NOT be returned to anonymous users. Current query-level filtering (`chapters.ts`, `lessons.ts`) does NOT check parent visibility:
- Chapters don't filter on `course.status` and `course.isActive`
- Lessons don't filter on `chapter.status`, `chapter.isActive`, `chapter.course.status`, or `chapter.course.isActive`

The hierarchy invariant must be enforced - this is explicitly stated in FR-004 but requires dot-path constraints like `course.status` in the where clause.

**Fix Applied:** Added explicit hierarchy requirements to FR-002, FR-003, and FR-004. Also added acceptance criteria for hierarchy invariant.

### Gap 4: Frontend query repos bypass access control

**Severity:** High
**Location:** `src/server/repos/queries/courses.ts`, `chapters.ts`, `lessons.ts`
**Issue:** The query repos manually filter by `status` and `isActive` at query level but do NOT use `overrideAccess: false`. This means:
1. They bypass collection-level access control
2. REST/GraphQL API calls can bypass these query filters entirely
3. No user context is passed

Additionally, they use `depth: 2` which could leak restricted content through relationship population.

**Fix Applied:** Added FR-006 specifically addressing Local API bypass prevention. Added acceptance criteria about public endpoints not leaking restricted content via depth population.

### Gap 5: Spec assumes authenticated = all access, but this may be too permissive

**Severity:** Medium
**Location:** Spec requirements vs. existing user roles
**Issue:** The spec says "If `req.user` is present, read access is allowed (no filtering)" - this means ALL authenticated users (including students) would see ALL content including drafts. This may be too permissive compared to current admin-only workflows. The spec has Open Question 1 about this.

**Fix Applied:** Added guardrail about not weakening create/update/delete access. The spec should clarify that authenticated user access should still respect role-based permissions - but this appears to be an intentional decision (all authenticated users get full access).

## Changes Made to Spec

### Enhanced FR-006: Local API bypass prevention

**Description:** Extended FR-006 to explicitly identify the query repo files that need to be audited and updated:
- `src/server/repos/queries/courses.ts` - currently manually filters but does NOT use `overrideAccess: false`
- `src/server/repos/queries/chapters.ts` - currently manually filters but does NOT check parent course visibility  
- `src/server/repos/queries/lessons.ts` - currently manually filters but does NOT check parent chapter/course visibility

Also added note about reducing `depth: 2` and using explicit `select` for public responses.

### Added Acceptance Criteria for Query Repo Verification

**Description:** Added specific checklist items to verify the query repos have been properly updated to either use `overrideAccess: false` OR manually apply the full set of filters including parent visibility.

### Clarified FR-004: Hierarchy Enforcement

**Description:** Made the hierarchy invariant requirements more explicit by specifying exact dot-path constraints needed:
- For Chapters: must check `course.status` and `course.isActive`
- For Lessons: must check `chapter.status`, `chapter.isActive`, `chapter.course.status`, and `chapter.course.isActive`

## No Gaps Found Areas

1. **Performance (NFR-002)**: The spec correctly identifies the need to avoid N+1 queries and suggests using query-level constraints or request context caching.

2. **Backward Compatibility (NFR-003)**: The spec correctly ensures admins can still view drafts.

3. **Response Minimization (NFR-004)**: The spec correctly addresses depth and field selection concerns.

4. **Guardrails**: All guardrails are appropriate and correctly prevent unintended side effects.
