# Fix for issue #2507: Relationship cells show "Loading..." indefinitely

## What was done

Created a custom `LessonRelationshipCell` component that bypasses Payload's
RelationshipProvider batch-fetch mechanism, which fails to resolve relationship
titles in the lesson-duplications list view.

**Root cause**: `RelationshipProvider`'s `loadRelationshipDocs` effect only
re-runs when `debouncedDocuments` *reference* changes. When `RelationshipCell`
dispatches a `REQUEST` action for an ID that's already `null` in state, the
state reference doesn't change → the effect never fires → cells stay on
"Loading..." forever.

**Fix**: `LessonRelationshipCell` fetches lesson titles directly from
`/api/lessons` with `depth=0&select=title` on mount, bypassing the broken
batch-fetch chain entirely.

## Files changed

- `src/server/payload/collections/LessonDuplications.ts` — added custom `Cell`
  components to both `sourceLesson` and `outputLesson` fields
- `src/ui/admin/LessonDuplications/Cells/LessonRelationshipCell/index.tsx` —
  new cell component that fetches titles directly

## Follow-ups

1. Run `pnpm generate:importmap` with env vars set to register the new component
2. Run the new E2E test against unfixed code to confirm it fails (proving test validity)
3. Consider fixing the root cause in @payloadcms/ui's RelationshipProvider
