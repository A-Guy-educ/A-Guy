# Gemini Provider Cleanup – High-Level Specification

## Goal

Isolate **all Gemini-specific complexity** into a single, well-defined provider layer, so that:

- Product logic stays clean and readable
- AI provider logic is swappable
- `agent/chat.ts` and `exercise-chat-service.ts` become thin orchestrators

This is a **refactor-only task**. No behavior change is allowed.

---

## Problem Statement (Current State)

- Gemini logic is **split across multiple layers**:
  - `gemini-ai-provider.server.ts` (client factory only)
  - `exercise-chat-service.ts` (model choice, retries, timeouts, mapping)
  - `agent/chat.ts` (still aware of AI invocation semantics)

Result:

- Files grow instead of shrink
- Hard to swap provider (Gemini → OpenAI / Claude)
- Hard to test AI boundary in isolation

---

## Target State (After Refactor)

- **One provider = one folder**
- One public entry point per provider
- Zero Gemini-specific logic outside the provider

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

export async function generateChatCompletion(input: GenerateChatInput): Promise<GenerateChatOutput>
```

Rules:

- No Payload types
- No product concepts (lesson, exercise, memory)
- Pure AI boundary

---

## Responsibility Split

### gemini.provider.ts

- Orchestrates the Gemini call
- Applies timeout / retry
- Returns normalized output

### gemini.client.ts

- Owns `GoogleGenerativeAI` init
- Caches client instance
- Reads env vars

### gemini.mapper.ts

- Converts internal `ChatMessage[]` → Gemini format
- Converts Gemini response → plain text

### gemini.errors.ts

- Maps Gemini SDK errors → domain-safe errors

---

## Changes Required in Existing Code

### agent/chat.ts

- **No Gemini imports**
- Only responsibility:
  - resolve prompt
  - build context
  - call `chatWithExerciseHelper`

---

### exercise-chat-service.ts

Before:

- Knows Gemini SDK
- Knows model mapping
- Knows retry/timeout

After:

- Calls **only**:

```ts
import { generateChatCompletion } from '@/lib/ai/providers/gemini'
```

- Passes `system + composedPrompt`
- Receives plain text

---

### gemini-ai-provider.server.ts

Status:

- ❌ Deleted or merged into `gemini.client.ts`

No standalone “provider factory” files allowed.

---

## Non-Goals

- No multi-provider abstraction yet
- No OpenAI / Claude adapter
- No config-driven provider selection
- No behavior change

---

## Testing Strategy

### Unit Tests (Required)

- `gemini.mapper.spec.ts`
  - message mapping correctness

- `gemini.provider.spec.ts`
  - timeout handling
  - retry behavior
  - error normalization

### Integration Tests (Unchanged)

- `agent-chat.int.spec.ts`
- `exercise-chat-service` tests

No snapshot changes allowed.

---

## Success Criteria

- `agent/chat.ts` contains **zero Gemini references**
- `exercise-chat-service.ts` shrinks significantly
- All Gemini SDK imports exist **only** under `providers/gemini/`
- CI passes with no behavior diff

---

## Exit Test (Mental Model)

If tomorrow you:

- replace Gemini with another provider

You should:

- delete `providers/gemini`
- implement `providers/openai`
- touch **no product code**

If that's not true — the refactor failed.

---

# Detailed Implementation Plan

## Phase 0: Preparation

### 0.1 Create Provider Directory Structure

```bash
mkdir -p src/lib/ai/providers/gemini
```

Create the following empty files:

- `src/lib/ai/providers/gemini/index.ts`
- `src/lib/ai/providers/gemini/gemini.provider.ts`
- `src/lib/ai/providers/gemini/gemini.client.ts`
- `src/lib/ai/providers/gemini/gemini.mapper.ts`
- `src/lib/ai/providers/gemini/gemini.errors.ts`
- `src/lib/ai/providers/gemini/gemini.types.ts`

### 0.2 Create Test Directory Structure

```bash
mkdir -p tests/unit/lib/ai/providers/gemini
```

---

## Phase 1: Types & Interfaces (`gemini.types.ts`)

### 1.1 Define Internal Types

**File:** `src/lib/ai/providers/gemini/gemini.types.ts`

```typescript
/**
 * Internal types for Gemini provider
 * These are NOT exported from the provider - internal only
 */

/** Gemini SDK role format */
export type GeminiRole = 'user' | 'model'

/** Gemini history item format (SDK contract) */
export interface GeminiHistoryItem {
  role: GeminiRole
  parts: Array<{ text: string }>
}

/** Model configuration from AI_MODELS */
export interface GeminiModelConfig {
  name: string
  temperature: number
  maxOutputTokens: number
}
```

### 1.2 Define Public Contract Types

**File:** `src/lib/ai/providers/gemini/gemini.provider.ts` (types section)

```typescript
/**
 * Public API types for Gemini provider
 * These are the ONLY types consumers should use
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIModel {
  name: string
  temperature: number
  maxOutputTokens: number
}

export interface GenerateChatInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  acknowledgment: string // Required for Gemini's system prompt simulation
  timeoutMs?: number
}

export interface GenerateChatOutput {
  text: string
  raw?: unknown // For debugging - Gemini response object
}
```

---

## Phase 2: Client Module (`gemini.client.ts`)

### 2.1 Migrate from `gemini-ai-provider.server.ts`

**File:** `src/lib/ai/providers/gemini/gemini.client.ts`

**Source code to migrate from:** `src/lib/ai/gemini-ai-provider.server.ts` (lines 1-31)

```typescript
/**
 * Gemini Client Module
 * Handles SDK initialization, singleton caching, and environment config
 *
 * @internal This module is used by gemini.provider.ts only
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

let geminiClient: GoogleGenerativeAI | null = null

/**
 * Check if Gemini API key is configured
 */
export function isGeminiApiKeyConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

/**
 * Get or create Gemini client singleton
 * @throws GeminiConfigError if API key not configured
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.')
    }
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return geminiClient
}

/**
 * Reset client singleton (for testing)
 * @internal
 */
export function resetGeminiClient(): void {
  geminiClient = null
}
```

**Changes from original:**

- Add `resetGeminiClient()` for testing
- Simplify error message (detailed message moves to `gemini.errors.ts`)

---

## Phase 3: Error Handling (`gemini.errors.ts`)

### 3.1 Define Domain-Safe Errors

**File:** `src/lib/ai/providers/gemini/gemini.errors.ts`

```typescript
/**
 * Gemini-specific error handling
 * Maps SDK errors to domain-safe errors
 */

/** Error codes for Gemini provider */
export const GeminiErrorCode = {
  CONFIG_ERROR: 'GEMINI_CONFIG_ERROR',
  API_ERROR: 'GEMINI_API_ERROR',
  TIMEOUT_ERROR: 'GEMINI_TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'GEMINI_RATE_LIMIT_ERROR',
  VALIDATION_ERROR: 'GEMINI_VALIDATION_ERROR',
} as const

export type GeminiErrorCode = (typeof GeminiErrorCode)[keyof typeof GeminiErrorCode]

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: GeminiErrorCode,
    public readonly retryable: boolean,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

/**
 * Determine if an error is retryable
 * @internal
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Non-retryable errors
  if (
    message.includes('api key') ||
    message.includes('invalid') ||
    message.includes('validation') ||
    message.includes('authentication')
  ) {
    return false
  }

  // Retryable errors (transient)
  return true
}

/**
 * Wrap SDK error in domain-safe GeminiError
 */
export function wrapGeminiError(error: Error): GeminiError {
  const message = error.message.toLowerCase()

  if (message.includes('api key')) {
    return new GeminiError(
      'GEMINI_API_KEY environment variable is not configured. Please set it in your .env file.',
      GeminiErrorCode.CONFIG_ERROR,
      false,
      error,
    )
  }

  if (message.includes('timeout')) {
    return new GeminiError(
      'Gemini API request timed out',
      GeminiErrorCode.TIMEOUT_ERROR,
      true,
      error,
    )
  }

  if (message.includes('rate') || message.includes('quota')) {
    return new GeminiError(
      'Gemini API rate limit exceeded',
      GeminiErrorCode.RATE_LIMIT_ERROR,
      true,
      error,
    )
  }

  if (message.includes('invalid') || message.includes('validation')) {
    return new GeminiError(error.message, GeminiErrorCode.VALIDATION_ERROR, false, error)
  }

  return new GeminiError(error.message, GeminiErrorCode.API_ERROR, true, error)
}
```

---

## Phase 4: Mapper Module (`gemini.mapper.ts`)

### 4.1 Extract Mapping Logic from `exercise-chat-service.ts`

**File:** `src/lib/ai/providers/gemini/gemini.mapper.ts`

**Source code to extract from:** `src/lib/ai/services/exercise-chat-service.ts` (lines 71-121)

```typescript
/**
 * Gemini Message Mapper
 * Converts between internal ChatMessage format and Gemini SDK format
 *
 * @internal This module is used by gemini.provider.ts only
 */
import type { GeminiHistoryItem, GeminiRole } from './gemini.types'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Convert internal role to Gemini format
 * - 'user' → 'user'
 * - 'assistant' → 'model'
 * - 'system' is handled separately (see mapMessagesToGeminiHistory)
 */
export function toGeminiRole(role: 'user' | 'assistant'): GeminiRole {
  return role === 'assistant' ? 'model' : 'user'
}

/**
 * Convert Gemini role to internal format
 */
export function fromGeminiRole(role: GeminiRole): 'user' | 'assistant' {
  return role === 'model' ? 'assistant' : 'user'
}

/**
 * Map internal messages to Gemini history format
 *
 * Key behaviors:
 * 1. System message → user message + model acknowledgment pair
 * 2. User/assistant messages → direct mapping
 * 3. Returns the current user message separately (for sendMessage)
 *
 * @param messages - Internal message array (may include system)
 * @param currentMessage - The current user message text
 * @param acknowledgment - Text for model to acknowledge system prompt
 * @returns Object with history array and extracted current message
 */
export function mapMessagesToGeminiHistory(
  messages: ChatMessage[],
  currentMessage: string,
  acknowledgment: string,
): {
  history: GeminiHistoryItem[]
  currentMessage: string
} {
  const history: GeminiHistoryItem[] = []
  let lastUserMessageContent: string | null = null

  for (const msg of messages) {
    if (msg.role === 'system') {
      // System message becomes user + model acknowledgment pair
      // (Gemini doesn't have native system messages)
      history.push({
        role: 'user',
        parts: [{ text: msg.content }],
      })
      history.push({
        role: 'model',
        parts: [{ text: acknowledgment }],
      })
    } else if (msg.role === 'user') {
      lastUserMessageContent = msg.content
      history.push({
        role: 'user',
        parts: [{ text: msg.content }],
      })
    } else if (msg.role === 'assistant') {
      history.push({
        role: 'model',
        parts: [{ text: msg.content }],
      })
    }
  }

  // CRITICAL: The current user message may already be in the history
  // (persisted before AI call). Remove it to avoid duplication.
  let finalCurrentMessage = currentMessage
  if (lastUserMessageContent === currentMessage && history.length > 0) {
    const lastEntry = history[history.length - 1]
    if (lastEntry.role === 'user') {
      history.pop()
      finalCurrentMessage = lastUserMessageContent
    }
  }

  return {
    history,
    currentMessage: finalCurrentMessage,
  }
}

/**
 * Extract text from Gemini response
 */
export function extractResponseText(response: { text: () => string }): string {
  return response.text()
}
```

### 4.2 Create Mapper Tests

**File:** `tests/unit/lib/ai/providers/gemini/gemini.mapper.spec.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  toGeminiRole,
  fromGeminiRole,
  mapMessagesToGeminiHistory,
} from '@/lib/ai/providers/gemini/gemini.mapper'

describe('gemini.mapper', () => {
  describe('toGeminiRole', () => {
    it('maps user to user', () => {
      expect(toGeminiRole('user')).toBe('user')
    })

    it('maps assistant to model', () => {
      expect(toGeminiRole('assistant')).toBe('model')
    })
  })

  describe('fromGeminiRole', () => {
    it('maps user to user', () => {
      expect(fromGeminiRole('user')).toBe('user')
    })

    it('maps model to assistant', () => {
      expect(fromGeminiRole('model')).toBe('assistant')
    })
  })

  describe('mapMessagesToGeminiHistory', () => {
    const acknowledgment = 'I understand.'

    it('converts system message to user+model pair', () => {
      const messages = [{ role: 'system' as const, content: 'You are a tutor.' }]
      const result = mapMessagesToGeminiHistory(messages, 'Hello', acknowledgment)

      expect(result.history).toHaveLength(2)
      expect(result.history[0]).toEqual({
        role: 'user',
        parts: [{ text: 'You are a tutor.' }],
      })
      expect(result.history[1]).toEqual({
        role: 'model',
        parts: [{ text: acknowledgment }],
      })
    })

    it('maps user messages correctly', () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }]
      const result = mapMessagesToGeminiHistory(messages, 'How are you?', acknowledgment)

      expect(result.history).toHaveLength(1)
      expect(result.history[0].role).toBe('user')
    })

    it('maps assistant messages to model role', () => {
      const messages = [{ role: 'assistant' as const, content: 'Hi there!' }]
      const result = mapMessagesToGeminiHistory(messages, 'Hello', acknowledgment)

      expect(result.history).toHaveLength(1)
      expect(result.history[0].role).toBe('model')
    })

    it('removes current message from history if already present', () => {
      const currentMsg = 'What is 2+2?'
      const messages = [
        { role: 'system' as const, content: 'You are a math tutor.' },
        { role: 'user' as const, content: currentMsg },
      ]
      const result = mapMessagesToGeminiHistory(messages, currentMsg, acknowledgment)

      // System (2 entries) + user message removed = 2 entries
      expect(result.history).toHaveLength(2)
      expect(result.currentMessage).toBe(currentMsg)
    })

    it('preserves current message if not duplicated', () => {
      const messages = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' },
      ]
      const result = mapMessagesToGeminiHistory(messages, 'New question', acknowledgment)

      expect(result.history).toHaveLength(2)
      expect(result.currentMessage).toBe('New question')
    })
  })
})
```

---

## Phase 5: Provider Core (`gemini.provider.ts`)

### 5.1 Implement Main Provider Logic

**File:** `src/lib/ai/providers/gemini/gemini.provider.ts`

**Source code to extract from:** `src/lib/ai/services/exercise-chat-service.ts` (lines 43-205)

```typescript
/**
 * Gemini Provider - Public API
 * Single entry point for all Gemini AI operations
 *
 * @public This is the ONLY file consumers should import from
 */
import { logger } from '@/utilities/logger'
import { getGeminiClient } from './gemini.client'
import { isRetryableError, wrapGeminiError, GeminiError } from './gemini.errors'
import { mapMessagesToGeminiHistory, extractResponseText } from './gemini.mapper'

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIModel {
  name: string
  temperature: number
  maxOutputTokens: number
}

export interface GenerateChatInput {
  system: string
  messages: ChatMessage[]
  model: AIModel
  acknowledgment: string
  timeoutMs?: number
}

export interface GenerateChatOutput {
  text: string
  raw?: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1_000

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a chat completion using Gemini
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Error normalization
 *
 * @param input - Chat input with system prompt, messages, and model config
 * @returns Chat output with response text
 * @throws GeminiError on failure after retries
 */
export async function generateChatCompletion(
  input: GenerateChatInput,
): Promise<GenerateChatOutput> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeWithTimeout(input, timeoutMs)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const geminiError = wrapGeminiError(lastError)

      // Don't retry non-retryable errors
      if (!isRetryableError(lastError)) {
        logger.error({ err: lastError, attempt }, '[GeminiProvider] Non-retryable error')
        throw geminiError
      }

      // Retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        logger.warn(
          { err: lastError, attempt, delay, retrying: true },
          '[GeminiProvider] Retrying after error',
        )
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  logger.error({ err: lastError }, '[GeminiProvider] All retries exhausted')
  throw wrapGeminiError(lastError ?? new Error('Unknown error'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Implementation
// ─────────────────────────────────────────────────────────────────────────────

async function executeWithTimeout(
  input: GenerateChatInput,
  timeoutMs: number,
): Promise<GenerateChatOutput> {
  const client = getGeminiClient()

  const model = client.getGenerativeModel({
    model: input.model.name,
    generationConfig: {
      temperature: input.model.temperature,
      maxOutputTokens: input.model.maxOutputTokens,
    },
  })

  // Build messages array with system message first
  const allMessages: ChatMessage[] = [{ role: 'system', content: input.system }, ...input.messages]

  // Get the current user message (last user message in the array)
  const userMessages = input.messages.filter((m) => m.role === 'user')
  const currentMessage =
    userMessages.length > 0 ? userMessages[userMessages.length - 1].content : ''

  // Map to Gemini format
  const { history, currentMessage: finalMessage } = mapMessagesToGeminiHistory(
    allMessages,
    currentMessage,
    input.acknowledgment,
  )

  logger.debug(
    {
      historyLength: history.length,
      messageCount: input.messages.length,
      currentMessagePreview: finalMessage.substring(0, 50),
    },
    '[GeminiProvider] Prepared chat history',
  )

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Model call timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  // Execute chat with timeout
  const chat = model.startChat({ history })
  const result = await Promise.race([chat.sendMessage(finalMessage), timeoutPromise])

  const text = extractResponseText(result.response)

  return {
    text,
    raw: result,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export { GeminiError, GeminiErrorCode } from './gemini.errors'
export { isGeminiApiKeyConfigured } from './gemini.client'
```

### 5.2 Create Provider Tests

**File:** `tests/unit/lib/ai/providers/gemini/gemini.provider.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGeminiMock } from '@/tests/mocks/gemini.mock'

// Mock the client module
vi.mock('@/lib/ai/providers/gemini/gemini.client', () => ({
  getGeminiClient: vi.fn(),
  isGeminiApiKeyConfigured: vi.fn(() => true),
}))

import { generateChatCompletion } from '@/lib/ai/providers/gemini/gemini.provider'
import { getGeminiClient } from '@/lib/ai/providers/gemini/gemini.client'
import { GeminiErrorCode } from '@/lib/ai/providers/gemini/gemini.errors'

describe('gemini.provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('generateChatCompletion', () => {
    const defaultInput = {
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user' as const, content: 'Hello' }],
      model: { name: 'gemini-2.0-flash-001', temperature: 0.7, maxOutputTokens: 2048 },
      acknowledgment: 'I understand.',
    }

    it('returns successful response', async () => {
      const mock = createGeminiMock('Test response')
      vi.mocked(getGeminiClient).mockReturnValue(mock.client as any)

      const result = await generateChatCompletion(defaultInput)

      expect(result.text).toBe('Test response')
      expect(mock.startChat).toHaveBeenCalled()
      expect(mock.sendMessage).toHaveBeenCalled()
    })

    it('throws on timeout', async () => {
      vi.useFakeTimers()

      const mock = createGeminiMock('Test response')
      mock.sendMessage.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 60_000)),
      )
      vi.mocked(getGeminiClient).mockReturnValue(mock.client as any)

      const resultPromise = generateChatCompletion({
        ...defaultInput,
        timeoutMs: 100,
      })

      vi.advanceTimersByTime(200)

      await expect(resultPromise).rejects.toThrow('timed out')
    })

    it('retries on transient errors', async () => {
      const mock = createGeminiMock('Success after retry')
      let callCount = 0
      mock.sendMessage.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('Network error')
        }
        return { response: { text: () => 'Success after retry' } }
      })
      vi.mocked(getGeminiClient).mockReturnValue(mock.client as any)

      const result = await generateChatCompletion(defaultInput)

      expect(result.text).toBe('Success after retry')
      expect(callCount).toBe(2)
    })

    it('does not retry on validation errors', async () => {
      const mock = createGeminiMock()
      mock.sendMessage.mockRejectedValue(new Error('Invalid API key'))
      vi.mocked(getGeminiClient).mockReturnValue(mock.client as any)

      await expect(generateChatCompletion(defaultInput)).rejects.toMatchObject({
        code: GeminiErrorCode.CONFIG_ERROR,
        retryable: false,
      })
    })
  })
})
```

### 5.3 Create Index File

**File:** `src/lib/ai/providers/gemini/index.ts`

````typescript
/**
 * Gemini Provider - Public Exports
 *
 * Usage:
 * ```ts
 * import { generateChatCompletion, isGeminiApiKeyConfigured } from '@/lib/ai/providers/gemini'
 * ```
 */
export {
  generateChatCompletion,
  type ChatMessage,
  type AIModel,
  type GenerateChatInput,
  type GenerateChatOutput,
  GeminiError,
  GeminiErrorCode,
  isGeminiApiKeyConfigured,
} from './gemini.provider'
````

---

## Phase 6: Migrate Consumers

### 6.1 Update `exercise-chat-service.ts`

**File:** `src/lib/ai/services/exercise-chat-service.ts`

**Before (214 lines):**

- Direct Gemini SDK usage
- Inline retry logic
- Inline timeout handling
- Inline message mapping

**After (~60 lines):**

```typescript
/**
 * AI Chat Service for Exercise Help
 * Orchestrates chat with Gemini provider
 */
import { logger } from '@/utilities/logger'
import type { ComposedPrompt } from '../context-policy'
import { AI_MODELS } from '../models'
import {
  generateChatCompletion,
  type ChatMessage as ProviderChatMessage,
  GeminiError,
} from '../providers/gemini'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ExerciseChatInput {
  message: string
  acknowledgment: string
  conversationHistory?: ChatMessage[]
  composedPrompt?: ComposedPrompt
}

export interface ExerciseChatResult {
  success: boolean
  message?: string
  error?: string
}

// Fallback for legacy callers (deprecated)
const LEGACY_FALLBACK = 'You are a helpful assistant.'

/**
 * @deprecated Use resolveAgentSystemPrompt from prompt-resolver.server instead.
 */
export function getSystemPrompt(): string {
  logger.warn('[DEPRECATED] getSystemPrompt() called - migrate to prompt resolver')
  return LEGACY_FALLBACK
}

export async function chatWithExerciseHelper(
  input: ExerciseChatInput,
): Promise<ExerciseChatResult> {
  try {
    // Build messages from composedPrompt or legacy format
    let systemPrompt: string
    let messages: ProviderChatMessage[]

    if (input.composedPrompt) {
      // Extract system from composed prompt
      const systemMsg = input.composedPrompt.messages.find((m) => m.role === 'system')
      systemPrompt = systemMsg?.content ?? LEGACY_FALLBACK

      // Convert to provider format
      messages = input.composedPrompt.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
    } else {
      // Legacy path
      systemPrompt = getSystemPrompt()
      messages =
        input.conversationHistory?.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? []
      // Add current message
      messages.push({ role: 'user', content: input.message })
    }

    const result = await generateChatCompletion({
      system: systemPrompt,
      messages,
      model: AI_MODELS.EXERCISE_CHAT,
      acknowledgment: input.acknowledgment,
    })

    return {
      success: true,
      message: result.text,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, '[ExerciseChat] Chat failed')

    return {
      success: false,
      error: errorMessage,
    }
  }
}
```

### 6.2 Update `data-extractor-service.ts`

**File:** `src/lib/ai/services/data-extractor-service.ts`

**Note:** This file uses `generateContent()` (not chat), so it needs a separate provider function or stays as-is for now. For this refactor, we keep it using the client directly but import from the provider:

```typescript
// Change import from:
import { getGeminiClient } from '../gemini-ai-provider.server'

// To:
import { getGeminiClient } from '../providers/gemini/gemini.client'
```

**Alternative (if full isolation needed):** Create `generateContent()` function in the provider.

### 6.3 Update `src/lib/ai/index.ts`

**File:** `src/lib/ai/index.ts`

```typescript
/**
 * AI Service Layer - Public API
 */

// Provider exports (new location)
export {
  generateChatCompletion,
  isGeminiApiKeyConfigured,
  GeminiError,
  GeminiErrorCode,
  type ChatMessage as ProviderChatMessage,
  type GenerateChatInput,
  type GenerateChatOutput,
} from './providers/gemini'

// Model config
export { AI_MODELS, type AIModelKey, type AIModelConfig } from './models'

// Image services
export { optimizeImageForAI, type OptimizedImage } from './services/image-optimizer-service'
export {
  extractFromImage,
  type ImageToExerciseInput,
  type ImageToExerciseResult,
  type ImageToExerciseResponse,
} from './services/data-extractor-service'

// Chat service (uses provider internally)
export {
  chatWithExerciseHelper,
  type ChatMessage,
  type ExerciseChatInput,
  type ExerciseChatResult,
} from './services/exercise-chat-service'

// Prompts
export { SIMPLE_TEXT_QUESTION_PROMPT } from './prompts/simple-text-question'
```

### 6.4 Delete Old Provider File

Delete `src/lib/ai/gemini-ai-provider.server.ts` after updating all imports.

### 6.5 Update `chat-message-role.ts`

Move Gemini-specific functions to provider, keep only internal role types:

**File:** `src/lib/ai/chat-message-role.ts` (simplified)

```typescript
/**
 * Chat Role Enum
 * Internal standard for message roles
 */
export enum ChatRole {
  User = 'user',
  Assistant = 'assistant',
}

export function isChatRole(value: unknown): value is ChatRole {
  return typeof value === 'string' && Object.values(ChatRole).includes(value as ChatRole)
}

export function parseChatRole(value: unknown): ChatRole {
  if (!isChatRole(value)) {
    throw new Error(`Invalid chat role: ${String(value)}`)
  }
  return value
}

// Remove: toGeminiRole, fromGeminiRole (now in provider)
// Remove: backward compatibility exports
```

---

## Phase 7: Update Tests

### 7.1 Update Test Mocks

**File:** `tests/mocks/gemini.mock.ts`

No changes needed - mock structure matches SDK interface.

### 7.2 Update Integration Tests

**File:** `tests/int/agent-chat.int.spec.ts`

Change mock path:

```typescript
// Change from:
vi.mock('@/lib/ai/services/exercise-chat-service', ...)

// Keep as-is (service still exists, just uses provider internally)
```

### 7.3 Verify All Tests Pass

```bash
pnpm test:int
pnpm test:unit
```

---

## Phase 8: Cleanup & Verification

### 8.1 Verify No Gemini Imports Outside Provider

Run grep to ensure isolation:

```bash
# Should only find files in providers/gemini/
grep -r "@google/generative-ai" src/

# Should find NO results
grep -r "gemini" src/endpoints/
grep -r "gemini" src/lib/ai/services/ | grep -v "providers"
```

### 8.2 Final File Structure

```
src/lib/ai/
├── providers/
│   └── gemini/
│       ├── index.ts              # Public exports
│       ├── gemini.provider.ts    # Main API (~100 lines)
│       ├── gemini.client.ts      # SDK init (~30 lines)
│       ├── gemini.mapper.ts      # Message mapping (~80 lines)
│       ├── gemini.errors.ts      # Error handling (~60 lines)
│       └── gemini.types.ts       # Internal types (~20 lines)
├── services/
│   ├── exercise-chat-service.ts  # Simplified (~60 lines, was 214)
│   └── data-extractor-service.ts # Unchanged (uses client directly)
├── models.ts                     # Unchanged
├── chat-message-role.ts          # Simplified (no Gemini refs)
├── context-policy.ts             # Unchanged
├── index.ts                      # Updated exports
└── ... (other files unchanged)
```

### 8.3 Deleted Files

- `src/lib/ai/gemini-ai-provider.server.ts` (merged into provider)

### 8.4 Line Count Comparison

| File                           | Before | After       | Change |
| ------------------------------ | ------ | ----------- | ------ |
| `exercise-chat-service.ts`     | 214    | ~60         | -154   |
| `gemini-ai-provider.server.ts` | 31     | 0 (deleted) | -31    |
| `chat-message-role.ts`         | 53     | ~25         | -28    |
| **New: `providers/gemini/*`**  | 0      | ~290        | +290   |
| **Net change**                 | 298    | ~375        | +77    |

Note: Total lines increase slightly, but complexity is **isolated**. The service layer is now thin and the provider is self-contained.

---

## Execution Order

1. **Phase 0**: Create directory structure
2. **Phase 1**: Define types
3. **Phase 2**: Implement client module
4. **Phase 3**: Implement error handling
5. **Phase 4**: Implement mapper + tests
6. **Phase 5**: Implement provider core + tests
7. **Phase 6**: Migrate consumers (exercise-chat-service, data-extractor-service, index.ts)
8. **Phase 7**: Update test mocks and run tests
9. **Phase 8**: Cleanup and verification

---

## Risk Mitigation

### Breaking Changes

- **None expected** - all public APIs remain the same
- `chatWithExerciseHelper` signature unchanged
- `ExerciseChatInput` / `ExerciseChatResult` types unchanged

### Testing Strategy

1. Run existing integration tests after each phase
2. Add unit tests for new modules in Phase 4-5
3. Final verification: `pnpm ci:local`

### Rollback Plan

- Keep `gemini-ai-provider.server.ts` until final verification
- Each phase should be a separate commit for easy rollback
