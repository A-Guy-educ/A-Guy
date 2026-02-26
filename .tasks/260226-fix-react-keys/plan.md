# Plan: Fix React Keys — Array Index → Stable Identifiers

**Task ID**: 260226-fix-react-keys
**Task Type**: fix_bug
**Risk**: Low
**Domain**: Frontend (React components)

---

## Problem Summary

Three React `.map()` loops use array indices as `key` props. When messages are streamed, deleted, or reordered, React misidentifies DOM elements causing flickering, animation glitches, or stale content.

**Affected locations**:
1. `src/ui/web/chat/ChatInterface/index.tsx` line 426: `key={idx}` for messages
2. `src/ui/web/chat/ChatInterface/index.tsx` line 439: `key={mediaIdx}` for nested media
3. `src/ui/web/chat/ChatInterface/index.tsx` line 459: `key={assetIdx}` for nested chatAssets
4. `src/ui/web/CollectionArchive/index.tsx` line 20: `key={index}` for archive posts

---

## Root Cause Analysis

**ChatMessage interface** (`src/ui/web/chat/hooks/useNotebookChat.ts:13-18`) has NO `id` field:
```typescript
export interface ChatMessage {
  role: ChatRole
  content: string
  media?: Array<{ mediaId: string; filename?: string; url?: string }>
  chatAssets?: Array<{ chatAssetId: string; filename?: string }>
}
```

Messages lack a stable unique identifier. Every message creation site constructs `ChatMessage` objects without IDs.

**Media items** DO have `mediaId` (stable).
**Chat assets** DO have `chatAssetId` (stable).
**CollectionArchive posts** have `slug` (stable, unique) via `CardPostData`.

---

## Fix Strategy

### Step 1: Add `id` field to ChatMessage and generate IDs at creation sites

**Root Cause**: `ChatMessage` interface lacks an `id` field, so the renderer has no stable identifier to use as a key.

**Files to Touch**:
- `src/ui/web/chat/hooks/useNotebookChat.ts` (MODIFIED)
  - Line 13-18: Add `id: string` to `ChatMessage` interface
  - Line 86: Add `id` to initial welcome message — `{ id: crypto.randomUUID(), role: ..., content: initialMessage }`
  - Line 205-218: Add `id` to loaded history messages — `{ id: crypto.randomUUID(), ...msg }`
  - Line 347-352: Add `id` to user messages — `{ id: crypto.randomUUID(), ...userMessage }`
  - Line 410-413: Add `id` to streaming placeholder messages — `{ id: crypto.randomUUID(), ...placeholderMessage }`
  - Line 533-536: Add `id` to sync assistant messages — `{ id: crypto.randomUUID(), ...assistantMessage }`
  - Line 559: Add `id` to reset welcome message — `{ id: crypto.randomUUID(), role: ..., content: initialMessage }`
  - All other `ChatMessage` creation sites in the file (search for `{ role: ChatRole.` pattern): each must include `id: crypto.randomUUID()`

**Important implementation note**: `crypto.randomUUID()` is available in all modern browsers and Node.js. It's used on the client side only ('use client' component). For the streaming update path (line 424-428) where the last message is updated in-place, the `id` from the placeholder MUST be preserved — the current code already does `{ ...placeholderMessage, content: fullText }` which will carry the `id` forward. Verify this is the case.

**Reproduction Test**:
- Test location: `tests/unit/components/chat/ChatInterface-keys.test.tsx`
- What it tests:
  1. Each `ChatMessage` object returned by `useNotebookChat` has a non-empty `id` string property
  2. All message IDs in the array are unique (no duplicates)
  3. When a new message is added, existing message IDs remain unchanged
- Why it fails before fix: `ChatMessage` objects have no `id` field, so `msg.id` is `undefined`

**Test code sketch** (integration test using `renderHook`):
```typescript
// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotebookChat } from '@/ui/web/chat'
import { apiService } from '@/server/services/api/api-service'

describe('ChatMessage stable IDs', () => {
  it('initial welcome message has a stable id', async () => {
    const { result } = renderHook(() => useNotebookChat({ ...defaultProps }))
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0))
    expect(result.current.messages[0].id).toBeDefined()
    expect(typeof result.current.messages[0].id).toBe('string')
    expect(result.current.messages[0].id.length).toBeGreaterThan(0)
  })

  it('all messages have unique ids', async () => {
    // Mock conversation history with multiple messages
    apiService.getConversation.mockResolvedValueOnce({
      success: true, exists: true,
      messages: [
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'How can I help?' },
      ],
    })
    const { result } = renderHook(() => useNotebookChat({ ...defaultProps }))
    await waitFor(() => expect(result.current.messages.length).toBe(3))
    const ids = result.current.messages.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

**Acceptance Criteria**:
- [ ] `ChatMessage` interface has `id: string` field
- [ ] Every `ChatMessage` object created in `useNotebookChat` includes a generated `id`
- [ ] All IDs are unique UUIDs
- [ ] Streaming message updates preserve the original placeholder ID
- [ ] Tests pass: `pnpm vitest run tests/unit/components/chat/ChatInterface-keys.test.tsx`

---

### Step 2: Use `msg.id` as React key in ChatInterface message loop

**Root Cause**: Line 426 uses `key={idx}` (array index) instead of the new stable `msg.id`.

**Files to Touch**:
- `src/ui/web/chat/ChatInterface/index.tsx` (MODIFIED)
  - Line 426: Change `key={idx}` → `key={msg.id}`
  - Line 421: Change `const messageId = \`msg-${idx}\`` → `const messageId = msg.id` (TTS also benefits from stable IDs)
  - Line 419: The `.map((msg, idx) =>` can drop `idx` parameter since it's no longer needed for key or messageId

**Reproduction Test** (add to same test file):
- Test: Render `ChatInterface` snapshot / shallow render and verify the top-level message `div` elements use stable UUID-format keys, not sequential integers.
- Since `ChatInterface` is complex with many dependencies, a more practical approach: a **static analysis test** that reads the source file and asserts no `key={idx}` or `key={index}` patterns remain in the message map section.

```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('ChatInterface key stability', () => {
  it('does not use array index as key for messages', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../../src/ui/web/chat/ChatInterface/index.tsx'),
      'utf-8',
    )
    // Find the messages.map section — should NOT contain key={idx} or key={index}
    const messageMapMatch = source.match(/messages\.map\([\s\S]*?\)\)\s*\}/)?.[0] || ''
    expect(messageMapMatch).not.toMatch(/key=\{idx\}/)
    expect(messageMapMatch).not.toMatch(/key=\{index\}/)
    // Should use msg.id
    expect(messageMapMatch).toMatch(/key=\{msg\.id\}/)
  })
})
```

**Acceptance Criteria**:
- [ ] `key={idx}` replaced with `key={msg.id}` on the message `<div>`
- [ ] `messageId` for TTS uses `msg.id` instead of `msg-${idx}`
- [ ] No array index keys remain in the messages `.map()` block
- [ ] TypeScript compilation passes: `pnpm tsc --noEmit`

---

### Step 3: Use stable keys for nested media and chatAssets in ChatInterface

**Root Cause**: Lines 439 and 459 use `key={mediaIdx}` and `key={assetIdx}` (array indices) for nested items. Media items have `mediaId` and chat assets have `chatAssetId` — both are stable.

**Files to Touch**:
- `src/ui/web/chat/ChatInterface/index.tsx` (MODIFIED)
  - Line 439: Change `key={mediaIdx}` → `key={mediaItem.mediaId}`
  - Line 459: Change `key={assetIdx}` → `key={asset.chatAssetId}`

**Reproduction Test** (add to same test file):
```typescript
it('does not use array index as key for media or chatAssets', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../../src/ui/web/chat/ChatInterface/index.tsx'),
    'utf-8',
  )
  // No key={mediaIdx} or key={assetIdx}
  expect(source).not.toMatch(/key=\{mediaIdx\}/)
  expect(source).not.toMatch(/key=\{assetIdx\}/)
  // Should use stable IDs
  expect(source).toMatch(/key=\{mediaItem\.mediaId\}/)
  expect(source).toMatch(/key=\{asset\.chatAssetId\}/)
})
```

**Acceptance Criteria**:
- [ ] `key={mediaIdx}` replaced with `key={mediaItem.mediaId}`
- [ ] `key={assetIdx}` replaced with `key={asset.chatAssetId}`
- [ ] TypeScript compilation passes

---

### Step 4: Use `slug` as React key in CollectionArchive

**Root Cause**: Line 20 uses `key={index}` (array index). `CardPostData` includes `slug` which is unique per course/post.

**Files to Touch**:
- `src/ui/web/CollectionArchive/index.tsx` (MODIFIED)
  - Line 20: Change `key={index}` → `key={result.slug}`
  - Line 17: Drop `index` from `.map((result, index)` → `.map((result)`

**Reproduction Test** (add to same test file or a dedicated `CollectionArchive-keys.test.tsx`):
```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('CollectionArchive key stability', () => {
  it('uses slug as key instead of array index', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../../src/ui/web/CollectionArchive/index.tsx'),
      'utf-8',
    )
    expect(source).not.toMatch(/key=\{index\}/)
    expect(source).toMatch(/key=\{result\.slug\}/)
  })
})
```

**Acceptance Criteria**:
- [ ] `key={index}` replaced with `key={result.slug}`
- [ ] TypeScript compilation passes

---

## Final Verification Checklist

- [ ] `pnpm tsc --noEmit` — TypeScript compiles with no errors
- [ ] `pnpm vitest run tests/unit/components/chat/ChatInterface-keys.test.tsx` — All key tests pass
- [ ] `pnpm vitest run tests/unit/hooks/useNotebookChat.test.ts` — Existing hook tests still pass (regression check)
- [ ] No `key={idx}`, `key={index}`, `key={mediaIdx}`, or `key={assetIdx}` remain in modified files
- [ ] Streaming message updates preserve the placeholder's `id` (the spread pattern already does this)

---

## Assumptions

1. `crypto.randomUUID()` is available in the browser environment (all modern browsers support it; this project targets modern browsers based on Next.js usage)
2. `slug` is always defined on `CardPostData` items passed to `CollectionArchive` (the `Card` component already uses `slug` for href construction, confirming it's expected to be present)
3. The `mediaId` field on media items and `chatAssetId` on chat assets are always unique within a single message's array (they reference distinct uploaded files)
4. No downstream code depends on the `messageId` format being `msg-${idx}` (the TTS hook stores and compares `playingMessageId` — changing from index-based to UUID-based is safe since comparison is identity-based)

---

## Files Summary

| File | Action | Lines Changed |
|---|---|---|
| `src/ui/web/chat/hooks/useNotebookChat.ts` | MODIFIED | ~15 lines (add `id` to interface + all creation sites) |
| `src/ui/web/chat/ChatInterface/index.tsx` | MODIFIED | ~6 lines (keys + messageId) |
| `src/ui/web/CollectionArchive/index.tsx` | MODIFIED | ~2 lines (key change) |
| `tests/unit/components/chat/ChatInterface-keys.test.tsx` | NEW | ~80 lines (all key stability tests) |

**Estimated time**: 20–30 minutes total across all steps.
