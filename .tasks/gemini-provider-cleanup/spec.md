# Gemini Provider Cleanup – High-Level Specification

## Goal

Isolate **all Gemini-specific complexity** into a single, well-defined provider layer, so that:

* Product logic stays clean and readable
* AI provider logic is swappable
* `agent/chat.ts` and `exercise-chat-service.ts` become thin orchestrators

This is a **refactor-only task**. No behavior change is allowed.

---

## Problem Statement (Current State)

* Gemini logic is **split across multiple layers**:

  * `gemini-ai-provider.server.ts` (client factory only)
  * `exercise-chat-service.ts` (model choice, retries, timeouts, mapping)
  * `agent/chat.ts` (still aware of AI invocation semantics)

Result:

* Files grow instead of shrink
* Hard to swap provider (Gemini → OpenAI / Claude)
* Hard to test AI boundary in isolation

---

## Target State (After Refactor)

* **One provider = one folder**
* One public entry point per provider
* Zero Gemini-specific logic outside the provider

```
src/lib/ai/providers/
└── gemini/
    ├── gemini.provider.ts        # PUBLIC API (single entry point)
    ├── gemini.client.ts          # Client init + caching
    ├── gemini.mapper.ts          # Role / message mapping
    ├── gemini.errors.ts          # Provider-specific errors
    └── gemini.types.ts           # Internal provider types
```

---

## Provider Public Contract (Locked)

**File:** `gemini.provider.ts`

```ts
export interface GenerateChatInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  timeoutMs?: number
}

export interface GenerateChatOutput {
  text: string
  raw?: unknown
}

export async function generateChatCompletion(
  input: GenerateChatInput
): Promise<GenerateChatOutput>
```

Rules:

* No Payload types
* No product concepts (lesson, exercise, memory)
* Pure AI boundary

---

## Responsibility Split

### gemini.provider.ts

* Orchestrates the Gemini call
* Applies timeout / retry
* Returns normalized output

### gemini.client.ts

* Owns `GoogleGenerativeAI` init
* Caches client instance
* Reads env vars

### gemini.mapper.ts

* Converts internal `ChatMessage[]` → Gemini format
* Converts Gemini response → plain text

### gemini.errors.ts

* Maps Gemini SDK errors → domain-safe errors

---

## Changes Required in Existing Code

### agent/chat.ts

* **No Gemini imports**
* Only responsibility:

  * resolve prompt
  * build context
  * call `chatWithExerciseHelper`

---

### exercise-chat-service.ts

Before:

* Knows Gemini SDK
* Knows model mapping
* Knows retry/timeout

After:

* Calls **only**:

```ts
import { generateChatCompletion } from '@/lib/ai/providers/gemini'
```

* Passes `system + composedPrompt`
* Receives plain text

---

### gemini-ai-provider.server.ts

Status:

* ❌ Deleted or merged into `gemini.client.ts`

No standalone “provider factory” files allowed.

---

## Non-Goals

* No multi-provider abstraction yet
* No OpenAI / Claude adapter
* No config-driven provider selection
* No behavior change

---

## Testing Strategy

### Unit Tests (Required)

* `gemini.mapper.spec.ts`

  * message mapping correctness

* `gemini.provider.spec.ts`

  * timeout handling
  * retry behavior
  * error normalization

### Integration Tests (Unchanged)

* `agent-chat.int.spec.ts`
* `exercise-chat-service` tests

No snapshot changes allowed.

---

## Success Criteria

* `agent/chat.ts` contains **zero Gemini references**
* `exercise-chat-service.ts` shrinks significantly
* All Gemini SDK imports exist **only** under `providers/gemini/`
* CI passes with no behavior diff

---

## Exit Test (Mental Model)

If tomorrow you:

* replace Gemini with another provider

You should:

* delete `providers/gemini`
* implement `providers/openai`
* touch **no product code**

If that’s not true — the refactor failed.
