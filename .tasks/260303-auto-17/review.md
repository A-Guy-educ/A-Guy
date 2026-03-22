# Code Review: 260303-auto-17 — Fix Chat Image Upload

## Summary

The changes wire the existing but unused `processChatAssetAttachments()` function into both the non-streaming (`chat.ts`) and streaming (`pipeline.ts` + `chat-stream.ts`) chat paths, and improve the failed-upload UI in `ChatInterface/index.tsx` with error details and a retry button.

The primary fix (wiring dead code) is correct and well-structured. However, there is one **critical** runtime issue in the streaming path and several notable gaps.

---

## Critical

### C-1: Streaming path will throw at runtime when chat assets are attached

**File**: `src/infra/llm/services/exercise-chat-service.ts:182-184`  
**File**: `src/server/payload/endpoints/agent/chat-stream.ts:174-175` (comment says chatAssetIds ARE supported)  
**File**: `src/server/payload/endpoints/agent/chat-stream.ts:214-215` (passes mediaPartsWithPath)

`streamChatWithExerciseHelper()` explicitly throws if `mediaPartsWithPath` has any entries:

```typescript
// exercise-chat-service.ts:181-184
if (input.mediaPartsWithPath && input.mediaPartsWithPath.length > 0) {
  throw new Error('Multimedia content is not supported in streaming mode')
}
```

Yet `chat-stream.ts` now passes `mediaPartsWithPath` from the pipeline result (line 214-215) and adds a comment at line 174 stating "chatAssetIds ARE supported in streaming mode since they use public URLs". The comment is incorrect — the downstream service will reject them unconditionally.

**Impact**: Any student who uploads an image and sends a message via the streaming endpoint will get a 500 error ("Multimedia content is not supported in streaming mode"). The streaming endpoint is likely the default path, so this could make image uploads appear broken in the most common flow.

**Fix**: Either (a) update `streamChatWithExerciseHelper` to actually support multimodal content (at least URL-based media like chat assets), or (b) reject `chatAssetIds` early in `chat-stream.ts` with a clear 400 error (matching the existing `mediaIds` rejection pattern at line 167-172), or (c) fall back to non-streaming for messages with attachments.

---

## Major

### M-1: `handleAdminModeChat` does not process chat assets for AI consumption

**File**: `src/server/payload/endpoints/agent/chat.ts:267-521`

The plan (Step 2) specified adding `processChatAssetAttachments` to `handleAdminModeChat`. The build agent persists `chatAssetIds` in the user message (line 301) but **never calls `processChatAssetAttachments`**, so the AI never receives the image in admin mode.

Neither the tool-calling path (line 395-418) nor the fallback `chatWithExerciseHelper` call (line 460-479) passes `mediaPartsWithPath`. The import for `processChatAssetAttachments` was added (line 56) but is unused in this function.

**Impact**: Admin users who upload images in admin mode chat will have the image stored but the AI will not see it — the same bug the fix was supposed to address, just in the admin path.

### M-2: `overrideAccess: true` in chat-asset-processing bypasses access control

**File**: `src/server/payload/endpoints/agent/chat/chat-asset-processing.ts:36`

```typescript
const { docs: chatAssets } = await payload.find({
  collection: 'chat-assets',
  where: {
    and: [{ id: { in: chatAssetIds } }, { createdBy: { equals: userId } }],
  },
  overrideAccess: true,
})
```

While the `where` clause filters by `createdBy: { equals: userId }`, this is application-level filtering, not Payload access control enforcement. If the `chat-assets` collection has additional access control rules (e.g., checking asset status, organization scope, or conversation membership), they are bypassed. This pattern violates the project's security rules documented in AGENTS.md: "When passing `user` to Local API, ALWAYS set `overrideAccess: false`".

**Mitigation**: This pre-existed the current changes (the function existed as dead code). However, now that it's being actively called, it should be reviewed. If the collection's access control properly handles the ownership check, the `where` clause is redundant and `overrideAccess: false` should be used instead.

### M-3: No integration tests written despite plan requiring them

**File**: Plan Step 5 specifies `tests/int/chat-asset-to-ai.int.spec.ts` (NEW)  
**Build report**: "No new test files created"

The plan required integration tests proving that `processChatAssetAttachments` is correctly wired and `chatWithExerciseHelper` receives `mediaPartsWithPath`. None were written. This is the core validation that the bug is fixed. Existing unit tests (2884) do not cover this new wiring.

---

## Minor

### m-1: Retry button aria-label is not i18n-compliant

**File**: `src/ui/web/chat/ChatInterface/index.tsx:621`

```tsx
aria-label="Retry upload"
```

All other aria-labels in this component use `tCourses(...)` for i18n. This hardcoded English string will not be translated for Hebrew/RTL users. Should use a translation key like `tCourses('chatRetryUpload')`.

### m-2: Error message display is not i18n-friendly

**File**: `src/ui/web/chat/ChatInterface/index.tsx:614`

```tsx
{file.error || 'Failed'}
```

The fallback `'Failed'` is hardcoded English. If `file.error` is populated, it may also be an English string from the server. Per NFR-006, user-facing error strings should support i18n.

### m-3: `chatAssetResult.error` lacks `errorDetails` in pipeline.ts response

**File**: `src/server/payload/endpoints/agent/chat/pipeline.ts:278`

```typescript
response: Response.json({ error: chatAssetResult.error }, { status: 400 })
```

Compared to the `mediaResult` error response (line 262) which includes `{ error: mediaResult.error, details: mediaResult.errorDetails }`, the chat-asset error response omits details. This inconsistency makes debugging harder for the client.

### m-4: Misleading comment in chat-stream.ts

**File**: `src/server/payload/endpoints/agent/chat-stream.ts:174-175`

```typescript
// Note: chatAssetIds ARE supported in streaming mode since they use public URLs
// (processed in pipeline via processChatAssetAttachments)
```

This comment is factually wrong — see C-1. The comment should be removed or corrected to prevent future confusion.

### m-5: `requestId` parameter is unused in `handleAdminModeChat`

**File**: `src/server/payload/endpoints/agent/chat.ts:269`

The `requestId` parameter is accepted but never used for logging or correlation in admin mode chat, reducing observability per NFR-004.

---

## Positive Observations

1. **Core fix is correct**: The wiring of `processChatAssetAttachments` in `handleContextScopedChat` (chat.ts:726-741) and `runChatPipeline` (pipeline.ts:269-283) follows the existing `processMediaAttachments` pattern cleanly.

2. **Proper merging**: The `allMediaParts` array correctly merges both legacy media and chat asset media parts before passing to the AI service.

3. **ChatPipelineResult extension**: Adding `mediaPartsWithPath` to the interface (pipeline.ts:68) is well-structured and enables the streaming handler to access processed media.

4. **UI improvement**: The retry button and error message display (ChatInterface/index.tsx:609-625) follows the existing component patterns and properly uses the `retryDirectUpload` callback from the hook chain.

5. **Export gap fixed**: Adding the re-export in `chat/index.ts:6` is the correct minimal change.

6. **TypeScript compiles**: Build report confirms no type errors.

---

## Verdict

**NEEDS FIX** — C-1 (streaming throws at runtime with chat assets) must be resolved before merge. M-1 (admin mode gap) and M-3 (missing tests) should also be addressed.
