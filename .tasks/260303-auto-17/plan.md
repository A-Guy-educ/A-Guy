# Plan: 260303-auto-17 — Fix Chat Image Upload ("Failed" Status + AI Never Sees Image)

## Rerun Context

This is a rerun. The previous run was triggered with `/cody rerun` with no specific feedback about issues. No previous plan.md existed — writing fresh plan based on thorough codebase analysis.

## Bug Summary

**Two distinct bugs** were identified:

### Bug 1 (PRIMARY): Chat assets uploaded via direct-to-Blob are never sent to the AI model
- `processChatAssetAttachments()` in `chat-asset-processing.ts` exists and correctly converts chat-asset IDs to `MediaPartWithPath[]` objects the AI can consume
- **This function is NEVER CALLED** — it's dead code. Not imported in `chat/index.ts`, not called in `chat.ts` or `pipeline.ts`
- Chat asset IDs are persisted to conversation messages but never processed for AI consumption
- **Result**: Upload appears to succeed, AI responds without seeing the image

### Bug 2 (SECONDARY): "Failed" status in UI lacks actionable error info
- The UI shows generic "Failed" text with no retry button and no error code
- Error messages from the upload pipeline are stored in state (`file.error`) but never displayed to the user
- No retry button is visible for failed uploads (the `retryFile` callback exists but is not wired to any UI element)

### Bug 3 (MINOR): Streaming endpoint silently drops chatAssetIds
- `chat-stream.ts` rejects `mediaIds` but does NOT reject `chatAssetIds`
- `runChatPipeline()` in `pipeline.ts` processes `mediaIds` via `processMediaAttachments` but does NOT process `chatAssetIds`
- Chat assets are persisted to conversation but never sent to AI in streaming path either

## Root Cause Analysis

| Symptom | Root Cause | File |
|---------|-----------|------|
| AI can't see uploaded image | `processChatAssetAttachments` never called | `chat.ts:696-710`, `pipeline.ts:246-253`, `chat/index.ts:1-12` |
| UI shows "Failed" without details | `file.error` not rendered, no retry button | `ChatInterface/index.tsx:657` |
| `chat/index.ts` missing export | `chat-asset-processing.ts` not re-exported | `chat/index.ts` |

## Requirements Coverage

| Req ID | Description | Steps |
|--------|-------------|-------|
| FR-001 | Student can upload chat image in prod | Step 1, Step 2 |
| FR-002 | Case-insensitive extensions / MIME validation | Already handled by `@vercel/blob/client` + constants |
| FR-003 | End-to-end attachment contract (upload → message → AI) | Step 1 (primary fix) |
| FR-004 | Actionable error handling | Step 3 |
| FR-005 | Retry and non-blocking behavior | Step 3 |
| NFR-001 | Auth + scoped access | Already enforced; Step 1 preserves it |
| NFR-004 | Correlation/stage-level diagnostics | Step 1 (logging already in processChatAssetAttachments) |

---

## Step 1: Wire `processChatAssetAttachments` into the chat pipeline (15 min)

**Root Cause**: `processChatAssetAttachments` exists as dead code — never exported from `chat/index.ts`, never called in `chat.ts` (handleContextScopedChat) or `pipeline.ts` (runChatPipeline).

**Files to Touch**:

- `src/server/payload/endpoints/agent/chat/index.ts` (MODIFIED — add export line)
- `src/server/payload/endpoints/agent/chat/pipeline.ts` (MODIFIED — lines ~246-262, add chatAsset processing + merge results)
- `src/server/payload/endpoints/agent/chat.ts` (MODIFIED — lines ~696-740, add chatAsset processing + merge with mediaResult before AI call)

### Exact Changes

#### 1a. `chat/index.ts` — Export `chat-asset-processing.ts`

Add line: `export * from './chat-asset-processing'`

After this change, `processChatAssetAttachments` is importable from `./chat/index`.

#### 1b. `pipeline.ts` — Process chatAssetIds and merge into ChatPipelineResult

After `processMediaAttachments` call (line ~246), add:
```
// Process chat-asset attachments (direct-to-Blob uploads)
const chatAssetResult = await processChatAssetAttachments(
  req.payload,
  validated.chatAssetIds || [],
  ownerId,
  reqLogger as Logger,
)
if (!chatAssetResult.success) {
  return { response: Response.json({ error: chatAssetResult.error }, { status: 400 }) }
}
```

Merge media results:
```
const allMediaParts = [
  ...mediaResult.mediaPartsWithPath,
  ...chatAssetResult.mediaPartsWithPath,
]
```

Update the `ChatPipelineResult` interface to include `mediaPartsWithPath: MediaPartWithPath[]` and return it from the result object.

#### 1c. `chat.ts` — Process chatAssetIds in `handleContextScopedChat`

After `processMediaAttachments` call (line ~696), add identical chatAsset processing. Merge arrays before passing to `chatWithExerciseHelper`:
```
mediaPartsWithPath: allMediaParts.length > 0 ? allMediaParts : undefined,
```

Also do the same in `handleAdminModeChat` (line ~296) for completeness.

#### 1d. `chat-stream.ts` — Use merged media parts from pipeline

Update the streaming handler to pass `mediaPartsWithPath` from `pipelineResult` to `streamChatWithExerciseHelper`. Currently, streaming doesn't pass any media. After step 1b adds `mediaPartsWithPath` to `ChatPipelineResult`, use it:

```
streamChatWithExerciseHelper({
  ...existingParams,
  mediaPartsWithPath: pipelineData.mediaPartsWithPath.length > 0
    ? pipelineData.mediaPartsWithPath
    : undefined,
})
```

Also remove the early-rejection of `chatAssetIds` in stream handler (if we want streaming + images). Or, if the AI streaming service supports multimodal, keep it. If not, add a proper rejection message for chatAssetIds similar to mediaIds.

**Reproduction Test** (integration):

- Test location: `tests/int/chat-asset-to-ai.int.spec.ts` (NEW)
- Test: Mock `chatWithExerciseHelper`, create a chat-asset doc, send chat with `chatAssetIds: [assetId]`. Assert that `chatWithExerciseHelper` was called with `mediaPartsWithPath` containing an entry with the chat-asset's URL and mimeType.
- Why it fails now: `chatWithExerciseHelper` is called with `mediaPartsWithPath: undefined` because `processChatAssetAttachments` is never called.

**Verification**:
1. Run test → FAILS (mediaPartsWithPath is undefined when chatAssetIds provided)
2. Apply fix → PASSES (mediaPartsWithPath contains chat asset's URL and MIME type)

**Acceptance Criteria**:
- [ ] `processChatAssetAttachments` is exported from `chat/index.ts`
- [ ] `handleContextScopedChat` calls `processChatAssetAttachments` for `chatAssetIds`
- [ ] `runChatPipeline` calls `processChatAssetAttachments` for `chatAssetIds`
- [ ] `chatWithExerciseHelper` receives merged `mediaPartsWithPath` (legacy media + chat assets)
- [ ] Streaming path either supports chat assets or explicitly rejects them with a clear message
- [ ] TypeScript compiles (`pnpm -s tsc --noEmit`)

---

## Step 2: Add chatAsset processing to `handleAdminModeChat` (10 min)

**Root Cause**: Admin mode chat (`handleAdminModeChat`) also persists `chatAssetIds` in messages but never processes them for AI. The admin chat has two paths: tool-calling path and fallback path. Both need media support.

**Files to Touch**:

- `src/server/payload/endpoints/agent/chat.ts` (MODIFIED — lines ~296-508, admin mode handler)

### Exact Changes

Import `processChatAssetAttachments` (already available from `./chat/index`).

In `handleAdminModeChat`, after persisting the user message (~line 306), add:
```
const chatAssetResult = await processChatAssetAttachments(
  req.payload,
  validated.chatAssetIds || [],
  userId,
  reqLogger as Logger,
)
```

Pass the merged media to both the tool-calling path and the fallback `chatWithExerciseHelper` call.

**Reproduction Test**:

- Test location: `tests/int/chat-asset-to-ai.int.spec.ts` (same file as Step 1, new describe block)
- Test: As admin with `adminMode: true`, send chat with `chatAssetIds`. Assert AI receives `mediaPartsWithPath`.
- Why it fails: Admin mode never calls `processChatAssetAttachments`.

**Verification**:
1. Run test → FAILS (admin AI gets no mediaPartsWithPath)
2. Apply fix → PASSES

**Acceptance Criteria**:
- [ ] Admin mode tool-calling path receives chat asset media
- [ ] Admin mode fallback path receives chat asset media
- [ ] Existing admin mode tests still pass

---

## Step 3: Improve "Failed" UI with error details and retry button (15 min)

**Root Cause**: `ChatInterface/index.tsx` line 657 shows `<span className="text-xs text-red-500">Failed</span>` but does NOT display the `file.error` message, and does NOT render a retry button. The `retryFile` function exists in `useDirectChatAssetUpload` and is returned as `retryDirectUpload` from `useNotebookChat`, but is never called from the UI.

**Files to Touch**:

- `src/ui/web/chat/ChatInterface/index.tsx` (MODIFIED — line ~657, upload status area)

### Exact Changes

Replace the simple "Failed" text with:
```tsx
{file.status === 'failed' && (
  <>
    <span className="text-xs text-red-500 max-w-[100px] truncate" title={file.error}>
      {file.error || 'Failed'}
    </span>
    <button
      type="button"
      onClick={() => retryDirectUpload(file.localId)}
      className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
      aria-label="Retry upload"
    >
      <RotateCcw className="w-3 h-3 text-muted-foreground hover:text-primary" />
    </button>
  </>
)}
```

Import `RotateCcw` from `lucide-react` (already used in the project).

Verify that `retryDirectUpload` is available in the component's scope (it's returned from `useNotebookChat` which wraps `useDirectChatAssetUpload.retryFile`).

**Reproduction Test** (unit):

- Test location: `tests/unit/chat/chat-interface-upload-status.spec.tsx` (NEW)
- Test: Render upload status area with a file in `failed` state with `error: 'File size exceeds maximum'`. Assert: (a) the error message text is visible, (b) a retry button is rendered with correct aria-label, (c) clicking retry calls the retry handler.
- Why it fails: Currently only "Failed" text is shown; no error message, no retry button.

**Verification**:
1. Run test → FAILS (no error message text, no retry button in DOM)
2. Apply fix → PASSES

**Acceptance Criteria**:
- [ ] Failed upload shows the specific error message (e.g., "File size exceeds maximum", "File type not allowed", "Finalize failed")
- [ ] Failed upload shows a retry button
- [ ] Clicking retry re-queues the upload
- [ ] FR-004 satisfied: no more generic "Failed" only
- [ ] FR-005 satisfied: retry available

---

## Step 4: Update ChatPipelineResult type and streaming handler (10 min)

**Root Cause**: The `ChatPipelineResult` interface in `pipeline.ts` does not include `mediaPartsWithPath`, so the streaming handler cannot access the processed media from the pipeline result.

**Files to Touch**:

- `src/server/payload/endpoints/agent/chat/pipeline.ts` (MODIFIED — ChatPipelineResult interface + return value)
- `src/server/payload/endpoints/agent/chat-stream.ts` (MODIFIED — pass mediaPartsWithPath to streamChatWithExerciseHelper)
- `src/infra/llm/services/exercise-chat-service.ts` (MODIFIED — add `mediaPartsWithPath` to `StreamChatInput` if not already present)

### Exact Changes

#### 4a. `pipeline.ts` — Add mediaPartsWithPath to ChatPipelineResult

```typescript
export interface ChatPipelineResult {
  // ... existing fields ...
  mediaPartsWithPath: MediaPartWithPath[]
}
```

In the return statement of `runChatPipeline`, add:
```typescript
mediaPartsWithPath: allMediaParts,
```

(where `allMediaParts` is the merged array from Step 1b)

#### 4b. `chat-stream.ts` — Pass media to streaming LLM

In the `streamChatWithExerciseHelper` call (~line 202), add:
```typescript
mediaPartsWithPath: pipelineData.mediaPartsWithPath.length > 0
  ? pipelineData.mediaPartsWithPath
  : undefined,
```

Remove or update the early rejection of `mediaIds` in streaming (line ~164) to also handle `chatAssetIds` consistently. Since chat assets work via URL (no file path needed), they can work in streaming mode.

#### 4c. Verify `streamChatWithExerciseHelper` accepts mediaPartsWithPath

Check that the streaming chat service function signature accepts `mediaPartsWithPath`. If it uses the same `ExerciseChatInput` interface that already has this field, no change is needed.

**Reproduction Test**:

- Test location: `tests/int/chat-asset-to-ai.int.spec.ts` (same file, new test)
- Test: Send a streaming chat request with `chatAssetIds`. Assert that `streamChatWithExerciseHelper` is called with `mediaPartsWithPath` containing the chat asset data.
- Why it fails: Streaming path never processes chatAssetIds.

**Verification**:
1. Run test → FAILS (streaming doesn't pass media)
2. Apply fix → PASSES

**Acceptance Criteria**:
- [ ] `ChatPipelineResult` includes `mediaPartsWithPath`
- [ ] Streaming handler passes media to AI
- [ ] Streaming with chat assets works end-to-end
- [ ] TypeScript compiles (`pnpm -s tsc --noEmit`)

---

## Step 5: Integration test — full end-to-end chat-asset-to-AI flow (15 min)

**Files to Touch**:

- `tests/int/chat-asset-to-ai.int.spec.ts` (NEW — main integration test file)

### Test Structure

```
describe('Chat Asset to AI Pipeline')
  describe('processChatAssetAttachments unit behavior')
    it('returns empty array for empty chatAssetIds')
    it('returns mediaPartsWithPath with URL and mimeType for valid assets')
    it('filters out expired assets')
    it('returns error when no valid assets found')
    it('filters out assets not owned by user')

  describe('handleContextScopedChat with chatAssetIds')
    it('passes mediaPartsWithPath to chatWithExerciseHelper when chatAssetIds provided')
    it('merges legacy mediaIds and chatAssetIds into single mediaPartsWithPath')
    it('succeeds with only chatAssetIds (no legacy mediaIds)')

  describe('runChatPipeline with chatAssetIds')
    it('includes mediaPartsWithPath in pipeline result')

  describe('streaming path with chatAssetIds')
    it('passes mediaPartsWithPath to streamChatWithExerciseHelper')
```

**Test Setup**: 
- Mock `chatWithExerciseHelper` and `streamChatWithExerciseHelper` (same pattern as existing `agent-chat.int.spec.ts`)
- Create real `chat-assets` documents in test DB
- Create real user, lesson/exercise for context
- Call `agentChat` / `agentChatStream` with `chatAssetIds`
- Assert the mock was called with `mediaPartsWithPath` containing correct URLs

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Coverage confirms `processChatAssetAttachments` is exercised
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm -s lint` passes

---

## File Change Summary

| File | Change | Lines |
|------|--------|-------|
| `src/server/payload/endpoints/agent/chat/index.ts` | MODIFIED — add `export * from './chat-asset-processing'` | +1 line |
| `src/server/payload/endpoints/agent/chat/pipeline.ts` | MODIFIED — call `processChatAssetAttachments`, merge results, update interface | ~20 lines added |
| `src/server/payload/endpoints/agent/chat.ts` | MODIFIED — call `processChatAssetAttachments` in both handlers, merge with mediaResult | ~30 lines added |
| `src/server/payload/endpoints/agent/chat-stream.ts` | MODIFIED — pass mediaPartsWithPath to streaming AI call | ~5 lines changed |
| `src/ui/web/chat/ChatInterface/index.tsx` | MODIFIED — show error message + retry button for failed uploads | ~15 lines changed |
| `tests/int/chat-asset-to-ai.int.spec.ts` | NEW — integration tests for chat asset → AI pipeline | ~200 lines |

## Assumptions

1. `streamChatWithExerciseHelper` accepts `mediaPartsWithPath` in its input (same as sync variant) — will verify during implementation
2. Chat assets have `url` field (public Vercel Blob URL) that the AI can access — confirmed in `chat-asset-processing.ts` line 72
3. The `onUploadCompleted` webhook timing issue (Bug 2 secondary cause) is not the primary cause of "Failed" — the existing retry + backoff handles race conditions; the primary fix is wiring the processing function
4. No changes needed to `processChatAssetAttachments` itself — the function is correct, just not called
5. `RotateCcw` icon from lucide-react is available (standard lucide icon set)

## Validation Commands

```bash
# Type check
pnpm -s tsc --noEmit

# Run specific tests
pnpm vitest run tests/int/chat-asset-to-ai.int.spec.ts

# Run all chat-related tests
pnpm vitest run tests/int/agent-chat.int.spec.ts tests/int/agent-chat-streaming.int.spec.ts

# Lint
pnpm -s lint
```
