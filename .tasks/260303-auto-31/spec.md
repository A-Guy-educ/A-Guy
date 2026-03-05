# Spec: 260303-auto-31

## Overview

Restrict public read access for hierarchical content collections (Courses, Chapters, Lessons) so anonymous users cannot read draft/archived/inactive content, while authenticated users retain intended access. Ensure the fix is enforced consistently across Payload REST/GraphQL and any public-serving server code that uses the Local API.

## Requirements

### FR-001: Courses public read must be published + active

**Priority**: MUST
**Description**: Update the `courses` collection `access.read` so that:
- If `req.user` is present, read access is allowed (no filtering).
- If `req.user` is absent, reads are constrained to `status = 'published'` AND `isActive = true`.

### FR-002: Chapters public read must be published + active (and ancestor-safe)

**Priority**: MUST
**Description**: Update the `chapters` collection `access.read` so that:
- Authenticated users can read all.
- Anonymous users can read only chapters that are `status = 'published'` AND `isActive = true`.
- Anonymous users must NOT be able to read chapters whose parent course is not public-visible (course not `published + active`). The implementation must enforce this invariant (see FR-004).

### FR-003: Lessons public read must be published + active (and ancestor-safe)

**Priority**: MUST
**Description**: Update the `lessons` collection `access.read` so that:
- Authenticated users can read all.
- Anonymous users can read only lessons that are `status = 'published'` AND `isActive = true`.
- Anonymous users must NOT be able to read lessons whose parent chapter (and, transitively, course) is not public-visible. The implementation must enforce this invariant (see FR-004).

### FR-004: Define and enforce hierarchy visibility invariant

**Priority**: MUST
**Description**: Public visibility must be consistent across the hierarchy. Define and enforce the rule:

> A document is public-visible only if it is `published + active` AND all its ancestors in the hierarchy are `published + active`.

The chosen enforcement approach MUST be specified and implemented:
- **Preferred**: Read-time enforcement via access constraints that include parent visibility (e.g., dot-path constraints if supported by the project’s query patterns), or an equivalent approach that demonstrably prevents published children under draft/inactive parents from being returned to anonymous users.
- If read-time constraints cannot reliably enforce parent visibility, use an alternative (e.g., write-time publish validation/cascades or denormalized “isPublic” flags maintained by hooks) and document the tradeoffs.

### FR-005: Provide/reuse an access helper appropriate for custom `status`

**Priority**: MUST
**Description**: Implement or refactor an access helper in `src/server/payload/access/` for the above rules. It must:
- Filter on the collections’ **custom** `status` field (not Payload’s `_status` drafts field).
- Include `isActive = true` for anonymous reads.
- Be reusable across Courses/Chapters/Lessons.

### FR-006: Prevent Local API bypass on public-serving code paths

**Priority**: MUST
**Description**: Any server code path that can serve unauthenticated/public traffic and reads Courses/Chapters/Lessons via Payload Local API must not bypass access control. Concretely, such reads MUST either:
- set `overrideAccess: false` (and pass `user` when acting as an authenticated user), or
- apply equivalent explicit `where` constraints (published+active + ancestor-safe using dot-path constraints like `course.status`, `chapter.course.status`) and avoid returning restricted relationship data via depth.

**Key files to audit and update** (may require changes as part of this fix):
- `src/server/repos/queries/courses.ts` - currently manually filters but does NOT use `overrideAccess: false`
- `src/server/repos/queries/chapters.ts` - currently manually filters but does NOT use `overrideAccess: false` and does NOT check parent course visibility
- `src/server/repos/queries/lessons.ts` - currently manually filters but does NOT use `overrideAccess: false` and does NOT check parent chapter/course visibility

All three query files currently use `depth: 2` which could leak restricted content - consider reducing depth and using explicit `select` for public responses.

This includes (but is not limited to) frontend-rendered blocks/components and Next.js API routes that are callable without authentication.

### NFR-001: Security—no public exposure of non-public content

**Priority**: MUST
**Description**: Anonymous users must not be able to retrieve draft/archived/inactive Courses/Chapters/Lessons (or their data via relationship population) through REST, GraphQL, or any public API route.

### NFR-002: Performance—avoid N+1 and unbounded extra queries

**Priority**: SHOULD
**Description**: The access strategy should not introduce per-document lookups. If enforcing parent constraints requires additional queries, use query-level constraints (preferred) and/or caching on the request context to avoid N+1 behavior.

### NFR-003: Backward compatibility for authenticated/admin workflows

**Priority**: MUST
**Description**: Admin/editor experiences that rely on viewing drafts/archived content while logged in must continue to function.

### NFR-004: Response minimization for public JSON responses

**Priority**: SHOULD
**Description**: Public endpoints should avoid large relationship depths and should whitelist fields (`select`) to reduce the risk of leaking restricted related content.

## Acceptance Criteria

- [ ] Anonymous REST/GraphQL reads for `courses` return only documents with `status='published'` and `isActive=true`.
- [ ] Anonymous REST/GraphQL reads for `chapters` return only documents with `status='published'` and `isActive=true`.
- [ ] Anonymous REST/GraphQL reads for `lessons` return only documents with `status='published'` and `isActive=true`.
- [ ] Anonymous users cannot read (list or by ID) any `draft`, `archived`, or `isActive=false` document from these collections.
- [ ] Hierarchy invariant holds for anonymous users:
  - [ ] Chapters under non-public courses are not returned.
  - [ ] Lessons under non-public chapters/courses are not returned.
- [ ] Authenticated users who are intended to have broader visibility can still access non-published items as expected (at minimum: admins).
- [ ] Any unauthenticated/public-facing Next.js API routes that return course hierarchy data enforce access (e.g., `overrideAccess:false`) and do not include restricted related docs via depth population.
- [ ] Public responses do not leak admin-only related content via depth population (e.g., relationships to collections that are not publicly readable).
- [ ] Regression coverage exists (automated tests or equivalent) proving the above behaviors.

**Specific code verification required**:
- [ ] `src/server/repos/queries/courses.ts` - verify either uses `overrideAccess: false` OR manually applies `status + isActive` filters
- [ ] `src/server/repos/queries/chapters.ts` - verify either uses `overrideAccess: false` OR manually applies `status + isActive + parent course visibility` filters
- [ ] `src/server/repos/queries/lessons.ts` - verify either uses `overrideAccess: false` OR manually applies `status + isActive + parent chapter/course visibility` filters

## Guardrails

- Do not change the meaning of the existing `status` values (`draft`, `published`, `archived`) or the `isActive` flag.
- Do not introduce a dependency on Payload’s `_status` drafts field unless the collections are explicitly migrated to `versions.drafts` (not part of this task).
- Do not weaken create/update/delete access controls.
- Do not rely on Local API defaults for public reads; explicitly prevent access bypass on public-serving code paths.
- If caching is used for queries that may vary by user authentication/role, ensure cache keys cannot cause cross-user data leakage.

## Out of Scope

- Redesigning role/permission model (e.g., changing what `student` can see) unless required to meet the security requirement.
- Data migration/backfilling or schema restructuring beyond access control and any minimal supporting fields/hooks strictly required by the chosen hierarchy enforcement approach.
- Enabling/disabling Payload drafts/versions or changing publication workflow.
- UI/UX changes beyond verifying existing pages continue to work.

## Open Questions

1. Should “authenticated users see all” apply to **all authenticated roles** (including `student`), or should it be limited to admin/staff roles?
2. Must public visibility enforce the full hierarchy invariant (child visible only if ancestors are public), or is per-collection filtering sufficient?
3. Should public reads also require `isActive=true` in all cases (task example includes it), and do any existing public views intentionally show inactive items?
4. Should an existing `authenticatedOrPublished` helper be refactored (risk: it may be `_status`-based), or should a new helper be created specifically for `status + isActive`?
5. Are there known public endpoints/blocks that use Payload Local API with `depth > 0` that should be explicitly audited as part of this fix?
6. Do we need additional indexing (e.g., on `isActive` and/or parent relationship fields) to maintain performance after adding ubiquitous public filters?

## Domain Review Notes

- **@payload-expert**: Access `read` can return a where-constraint; do not reuse `_status`-based helpers for custom `status`. Define/enforce hierarchy invariant; consider performance impacts and Local API `overrideAccess` defaults.
- **@security-auditor**: Ensure public-serving server code does not bypass access via Local API defaults; clamp depth/whitelist fields for public JSON; ensure hierarchy invariant to prevent published children under draft parents; consider role scoping so students don’t automatically gain draft access if not intended.
