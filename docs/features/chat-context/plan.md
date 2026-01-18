# Implementation Plan: Fix Chat Context + Memory Integration

## Overview

This plan addresses critical correctness issues in the chat context system that prevent deterministic prompt composition. The current implementation injects summary and memory as fake user/assistant messages, uses wrong field names, and doesn't utilize the designed `composePrompt()` function.

**Goal**: Make the chat context system correct, deterministic, and safe according to Context Policy V1.

---

## Critical Issues Summary

### 1. **Prompt Pollution** (Highest Priority)
- **Problem**: [chat.ts:145-169](src/endpoints/agent/chat.ts#L145-L169) injects fake user/assistant message pairs for summary and memories
- **Impact**: Non-deterministic prompts, token waste, potential confusion for the model
- **Fix**: Use `composePrompt()` which appends summary/memories to system message instead

### 2. **Wrong Field Name** (Data Access Bug)
- **Problem**: [chat.ts:159](src/endpoints/agent/chat.ts#L159) uses `m.content` but MemoryItem schema defines `text`
- **Impact**: Runtime undefined access, memories not shown to model
- **Fix**: Change `m.content` → `m.text`

### 3. **composePrompt() Not Used** (Architectural Gap)
- **Problem**: [chat.ts:140-177](src/endpoints/agent/chat.ts#L140-L177) manually builds context instead of using designed function
- **Impact**: No deterministic ordering, missing metadata, policy violations
- **Fix**: Replace manual construction with `composePrompt()` call

### 4. **Message Duplication Risk** (Correctness Issue)
- **Problem**: User message handling is split:
  - Passed as `message` parameter [chat.ts:197](src/endpoints/agent/chat.ts#L197)
  - Added to conversationHistory [chat.ts:186-193](src/endpoints/agent/chat.ts#L186-L193)
  - Then sent again via `chat.sendMessage()` [exercise-chat-service.ts:78](src/lib/ai/services/exercise-chat-service.ts#L78)
- **Impact**: Potential duplication of latest user message in model context
- **Fix**: Ensure latest user message is in recentMessages, not passed separately

---

## Implementation Strategy

### Phase 1: Fix Core Data Issues

#### 1.1 Fix Memory Field Access
**File**: [src/endpoints/agent/chat.ts](../../src/endpoints/agent/chat.ts)

Change line 159: `m.content` → `m.text`

### Phase 2: Integrate composePrompt()

#### 2.1 Update Chat Endpoint
**File**: [src/endpoints/agent/chat.ts](../../src/endpoints/agent/chat.ts)

- Import `composePrompt` from context-policy
- Replace manual context building with `composePrompt()` call
- Use metadata from composed prompt for observability

#### 2.2 Refactor Chat Service Interface
**File**: [src/lib/ai/services/exercise-chat-service.ts](../../src/lib/ai/services/exercise-chat-service.ts)

- Add `composedPrompt?: ComposedPrompt` to ExerciseChatInput interface
- Update chatWithExerciseHelper() to use composedPrompt when provided
- Export getSystemPrompt() function for reuse
- Fix logger import to use consistent path

#### 2.3 Fix Message Flow Order
**File**: [src/endpoints/agent/chat.ts](../../src/endpoints/agent/chat.ts)

New flow:
1. Save user message to DB FIRST
2. Reload conversation to get updated messages
3. Build retrieval query from persisted messages
4. Retrieve memories
5. Compose prompt with all context
6. Call model
7. Save assistant response

This eliminates duplication and ensures consistency.

---

### Phase 3: Update Observability

Use metadata from `composedPrompt` in context logging:
- `composedPrompt.metadata.policyVersion`
- `composedPrompt.metadata.summaryLength`
- `composedPrompt.metadata.messageCount`

Add `logPromptSnapshot()` calls in development mode.

---

### Phase 4: Fix Logger Import Consistency

Standardize all logger imports to `@/utilities/logger` across `src/lib/ai/` directory.

---

### Phase 5: Update Tests

Verify test memory items use `text` field (not `content`) to match MemoryItem interface.

---

### Phase 6: Documentation

Create minimal documentation in this directory:
- ✅ plan.md (this file)
- ⏳ spec.md (feature specification)

---

## Critical Files Reference

### Files to Modify
| File | Changes |
|------|---------|
| [src/endpoints/agent/chat.ts](../../src/endpoints/agent/chat.ts) | Use composePrompt(), fix field access, fix message flow |
| [src/lib/ai/observability.ts](../../src/lib/ai/observability.ts) | Align context logging keys and metadata |
| [src/lib/ai/services/exercise-chat-service.ts](../../src/lib/ai/services/exercise-chat-service.ts) | Export getSystemPrompt, accept ComposedPrompt, fix logger import |
| [tests/int/memory-system.int.spec.ts](../../tests/int/memory-system.int.spec.ts) | Verify memory items use 'text' field |

### Reference Files (No Changes)
- [src/lib/ai/context-policy.ts](../../src/lib/ai/context-policy.ts) - Policy implementation ✓
- [src/lib/ai/vector-search.ts](../../src/lib/ai/vector-search.ts) - Vector retrieval ✓
- [src/lib/ai/maintenance.ts](../../src/lib/ai/maintenance.ts) - Summary maintenance ✓
- [src/lib/ai/memory-extraction.ts](../../src/lib/ai/memory-extraction.ts) - Memory extraction ✓

---

## Verification Plan

### Unit Tests
```bash
pnpm test:int tests/int/memory-system.int.spec.ts
```

### TypeScript Check
```bash
pnpm typecheck
```

### Integration Testing Scenarios

1. **Baseline**: Summary maintenance triggers at threshold
2. **Retrieval**: Memory retrieval with vector search
3. **Extraction**: Memory extraction runs in background
4. **Full system**: End-to-end chat with context and summaries

See detailed test scenarios in full plan above.

---

## Success Criteria

### Functional
- ✅ No fake summary/memory messages injected
- ✅ Memory items use correct 'text' field
- ✅ composePrompt() used for all context building
- ✅ Latest user message not duplicated
- ✅ Feature flags in logs show correct values

### Technical
- ✅ No TypeScript errors
- ✅ No unsafe type casts
- ✅ All imports consistent
- ✅ Integration tests pass
- ✅ Prompt order matches Policy V1 spec

### Observability
- ✅ Context logs show accurate metadata
- ✅ Prompt snapshots available in dev mode

---

## Rollout Strategy

Ensure the vector index is ready before deploying; memory features run by default.

---

## Implementation Details

For complete implementation code and detailed step-by-step instructions, see:
- Full plan with code examples in Claude plans directory
- Code comments in [src/lib/ai/context-policy.ts](../../src/lib/ai/context-policy.ts)
- Integration tests in [tests/int/memory-system.int.spec.ts](../../tests/int/memory-system.int.spec.ts)
