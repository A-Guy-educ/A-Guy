## CI Fix for PR #1873 (branch 1849-p2-ask-page-never-finishes-loading-stuck-on-loadin)

### Root Cause of CI Failure
`message-persist.int.spec.ts` returned HTTP 500 instead of 200 when creating a conversation with a unique contextKey.

**What happened**: The test creates `contextKey = "lessons:${testLessonId}-unique-${Date.now()}"`. The route parses this to extract `value = "${testLessonId}-unique-${Date.now()}"`. When the route creates a conversation with `contextRef: { relationTo: 'lessons', value: "${testLessonId}-unique-${Date.now()}" }`, Payload's relationship field validation throws because no lesson document has that exact ID.

### Fix Applied
Modified `src/app/api/agent/message/persist/route.ts` to validate that the referenced document actually exists before using it in `contextRef`. If the document doesn't exist:
- `contextRef` is set to `undefined` (omitted from the create data)
- The conversation is created with `contextKey` set explicitly
- The `beforeChange` hook on the conversations collection does NOT auto-derive `contextKey` (since `contextRef.value` is undefined)

This makes the route robust against non-existent contextRef values without changing the test.

### Files Changed
- `src/app/api/agent/message/persist/route.ts` — validates contextRef document existence before creating conversation
