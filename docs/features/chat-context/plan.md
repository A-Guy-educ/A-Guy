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

### 3. **Feature Flag Mismatch** (Type Safety Violation)
- **Problem**: [observability.ts:105-109](src/lib/ai/observability.ts#L105-L109) uses type cast to hide key mismatch
  - `getFeatureFlagStatus()` returns: `summaryMaintenance`, `memoryExtraction`, `memoryRetrieval`
  - `ContextLog.featureFlags` expects: `summaryEnabled`, `extractionEnabled`, `retrievalEnabled`
- **Impact**: Runtime undefined access when reading feature flags from logs
- **Fix**: Align keys (recommend updating ContextLog interface to match actual data)

### 4. **composePrompt() Not Used** (Architectural Gap)
- **Problem**: [chat.ts:140-177](src/endpoints/agent/chat.ts#L140-L177) manually builds context instead of using designed function
- **Impact**: No deterministic ordering, missing metadata, policy violations
- **Fix**: Replace manual construction with `composePrompt()` call

### 5. **Message Duplication Risk** (Correctness Issue)
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

#### 1.2 Align Feature Flag Keys
**Files**:
- [src/lib/ai/observability.ts](../../src/lib/ai/observability.ts)
- [src/lib/feature-flags.ts](../../src/lib/feature-flags.ts)

Update ContextLog interface and getFeatureFlagStatus() return type to match actual data structure. Remove unsafe type cast.

---

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
| [src/lib/ai/observability.ts](../../src/lib/ai/observability.ts) | Fix feature flag keys, remove type cast |
| [src/lib/feature-flags.ts](../../src/lib/feature-flags.ts) | Update return type signature |
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

1. **All Flags OFF**: Baseline functionality
2. **Summary Only**: Summary maintenance triggers at threshold
3. **Retrieval Only**: Memory retrieval with vector search
4. **Extraction Only**: Memory extraction runs in background
5. **All Flags ON**: Full system integration

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
- ✅ Feature flag status visible in all logs

---

## Rollout Strategy

1. Deploy with all flags OFF (default state)
2. Enable SUMMARY_MAINTENANCE_ENABLED → monitor for 1 week
3. Enable MEMORY_EXTRACTION_ENABLED → monitor for 1 week
4. Enable MEMORY_RETRIEVAL_ENABLED → full system active

---

## Implementation Details

For complete implementation code and detailed step-by-step instructions, see:
- Full plan with code examples in Claude plans directory
- Code comments in [src/lib/ai/context-policy.ts](../../src/lib/ai/context-policy.ts)
- Integration tests in [tests/int/memory-system.int.spec.ts](../../tests/int/memory-system.int.spec.ts)
