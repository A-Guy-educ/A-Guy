# Gap Analysis: 260226-auto-18

## Summary

- Gaps Found: 1
- Spec Revised: Yes

## Gaps Found

### Gap 1: Misleading suggestion to use `authenticatedOrPublished` pattern

**Severity:** High
**Location:** spec.md, line 31
**Issue:** The spec suggests "Or use the existing `authenticatedOrPublished` pattern from Pages/Posts collections." This is incorrect because:

1. The `authenticatedOrPublished` function uses `_status` field which is Payload's built-in draft versioning field
2. Courses/Chapters/Lessons collections do NOT use Payload's draft versioning - they use a custom `status` field with values `'draft' | 'published' | 'archived'`
3. These collections don't have `versions: { drafts: { ... } }` enabled (verified in all three files)
4. Using `authenticatedOrPublished` would filter by `_status` which doesn't exist in these collections, resulting in no filtering at all

**Fix Applied:** Updated spec to clarify that `authenticatedOrPublished` cannot be used because it operates on `_status` (Payload drafts), while these collections use a custom `status` field. The inline function shown in the spec (`return { status: { equals: 'published' } }`) is correct and should be used directly.

## Changes Made to Spec

- Added clarification: "NOTE: Cannot use `authenticatedOrPublished` because it filters by `_status` (Payload's draft field), but these collections use a custom `status` field without draft versioning enabled."
- Emphasized that the inline function shown in the spec is the correct approach
- Removed the misleading suggestion to reuse existing patterns

## Verification

Confirmed the issue exists:
- **Courses.ts**: Line 30 has `read: anyone`, has `status` field (lines 108-130) with `draft|published|archived` options
- **Chapters.ts**: Line 20 has `read: anyone`, has `status` field (lines 106-128) with `draft|published|archived` options  
- **Lessons.ts**: Line 20 has `read: anyone`, has `status` field (lines 120-142) with `draft|published|archived` options

None of these collections have `versions.drafts` enabled, confirming they use the custom `status` field approach.

The existing `authenticatedOrPublished` function (at `src/server/payload/access/authenticatedOrPublished.ts`) uses:
```typescript
return {
  _status: { equals: 'published' },
}
```

This would NOT work for Courses/Chapters/Lessons because they don't have `_status` field - they have `status` field.
