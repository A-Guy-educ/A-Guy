# Gap Analysis: 260226-auto-18

## Summary

- Gaps Found: 1
- Spec Revised: Yes

## Gaps Found

### Gap 1: Misleading Reference to Existing Access Pattern

**Severity:** Medium
**Location:** spec.md line 28 ("Or use the existing authenticatedOrPublished pattern from Pages/Posts collections")
**Issue:** The spec references using the existing `authenticatedOrPublished` pattern, but this pattern uses `_status` field (Payload's built-in draft system with `versions: { drafts: true }`). The Courses, Chapters, and Lessons collections use a custom `status` field with options `draft | published | archived` (not the built-in `_status` field).

**Current authenticatedOrPublished implementation:**
```typescript
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }
  return {
    _status: {  // Uses _status (built-in draft system)
      equals: 'published',
    },
  }
}
```

**Fix Applied:** The spec's "Expected Implementation" section already provides the correct solution using `status` (not `_status`). The reference to `authenticatedOrPublished` was removed from the spec to avoid confusion. The spec now explicitly shows the correct inline implementation:

```typescript
read: ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
}
```

## Changes Made to Spec

- **Removed** misleading reference to "existing authenticatedOrPublished pattern" (line 28)
- **Clarified** that the access function must use the custom `status` field (not `_status`)
- **Added** note that this is a custom implementation specific to collections with the `status` field

## Verification

Confirmed through codebase exploration:

1. **Courses.ts** (line 30): Has `read: anyone` and custom `status` field (draft/published/archived)
2. **Chapters.ts** (line 20): Has `read: anyone` and custom `status` field (draft/published/archived)
3. **Lessons.ts** (line 20): Has `read: anyone` and custom `status` field (draft/published/archived)
4. **authenticatedOrPublished** (access/authenticatedOrPublished.ts): Uses `_status` (built-in draft system)
5. **Pages/Posts**: Use `versions: { drafts: true }` which provides the `_status` field

No other collections were found with the same vulnerability pattern (having both `read: anyone` AND a custom `status` field with draft/published/archived options).
