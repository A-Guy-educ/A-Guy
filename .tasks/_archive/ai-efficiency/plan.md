# Implementation Plan: AI Efficiency Foundation (Stage 1)

## Overview

This plan implements full visibility and basic control over all AI calls in A-Guy: cost, latency, errors, and abuse prevention — without Redis, caching, routing, or failover.

**Timebox**: 2-4 working days

---

## Design Decisions

### Gateway Error Contract (CRITICAL)

**Decision: Option A — Gateway NEVER throws, always returns `AIGatewayResponse`**

Rationale:

- Consistent contract for all callers
- Error details always available in response
- AIUsage record guaranteed to be written before return
- Callers check `response.success` instead of try/catch

```typescript
// Gateway contract: NEVER throws
const response = await executeAIOperation(...)
if (!response.success) {
  // Handle error via response.error
  logger.error({ error: response.error }, 'AI operation failed')
  return // or handle gracefully
}
// Use response.data
```

### Rate Limiting (CRITICAL)

**Design: Best-effort, non-atomic DB-based limiting**

- Race conditions are **acceptable** in Stage 1
- No pseudo-locking or distributed coordination
- Two concurrent requests may both pass limit check
- This is documented and intentional

```typescript
// IMPORTANT: This is best-effort rate limiting.
// Race conditions between concurrent requests are acceptable in Stage 1.
// A user may occasionally exceed limits by a small margin under high concurrency.
// This will be replaced with Redis-based atomic limiting in a future stage.
```

### Token Accounting (CRITICAL)

**Rule: Use real provider data when available, null otherwise**

| Provider | Model                  | Token Data Available                      | Action                                   |
| -------- | ---------------------- | ----------------------------------------- | ---------------------------------------- |
| OpenAI   | gpt-4o-mini            | Yes: `prompt_tokens`, `completion_tokens` | Use exact values                         |
| OpenAI   | text-embedding-3-small | Yes: `total_tokens`                       | Use as `inputTokens`, `outputTokens = 0` |
| Gemini   | gemini-2.0-flash-001   | No                                        | Store `null` for both                    |

**Never estimate token splits** — only use real data from provider response.

### Gemini Pricing (MEDIUM)

**Decision: Set pricing to `null` until verified**

- Do NOT use placeholder/guessed pricing values
- Cost estimation returns `null` for Gemini operations
- Update pricing config only when official rates are confirmed

### Batch Embeddings (MEDIUM)

**Decision: Single atomic operation**

- Batch embedding = ONE `AIUsage` record
- If any item fails → entire batch = `error` status
- Token count = sum of all items in batch (total only, no per-item breakdown)
- `metadata.batchSize` records number of texts processed
- **Per-item `tokensUsed` in EmbeddingResult = `null`** (not available in batch mode)

### Rate Limit Counting Policy (MEDIUM)

**Decision: Blocked requests COUNT toward rate limits**

Rationale:

- Blocked requests indicate abuse patterns
- If we don't count them, an attacker could spam blocked requests indefinitely
- This is consistent with PRD requirement

```typescript
// Rate limit queries count ALL statuses (success, error, blocked)
// This is intentional - blocked requests indicate potential abuse
payload.count({
  collection: 'ai_usage',
  where: {
    and: [
      { user: { equals: userId } },
      { createdAt: { greater_than: oneMinuteAgo.toISOString() } },
      // NO status filter - count everything
    ],
  },
  overrideAccess: true,
})
```

### Rate Limit Failure Policy (LOW)

**Decision: Fail-open with logging (current default)**

Rationale for Stage 1:

- Fail-open prioritizes user experience over abuse prevention
- Rate limit check failures are logged for monitoring
- Abuse risk is documented and acceptable for Stage 1

Future consideration:

- Could switch to fail-closed for expensive operations (`chat`, `vision`)
- Would require explicit configuration per operation type

---

## Current State Analysis

### AI Operations Inventory

| Operation               | Provider | Location                                        | Tokens Available                           | Current Wrapper            |
| ----------------------- | -------- | ----------------------------------------------- | ------------------------------------------ | -------------------------- |
| **Chat**                | Gemini   | `src/lib/ai/services/exercise-chat-service.ts`  | No                                         | Yes - `gemini.provider.ts` |
| **Embedding**           | OpenAI   | `src/lib/ai/embeddings.ts`                      | Yes (`total_tokens`)                       | No - direct SDK            |
| **Summary**             | OpenAI   | `src/lib/ai/summary.ts`                         | Yes (`prompt_tokens`, `completion_tokens`) | No - direct SDK            |
| **Extraction** (memory) | OpenAI   | `src/lib/ai/memory-extraction.ts`               | Yes (`prompt_tokens`, `completion_tokens`) | No - direct SDK            |
| **Vision**              | Gemini   | `src/lib/ai/services/data-extractor-service.ts` | No                                         | No - direct SDK            |

### Call Site Locations

1. **Chat Endpoint** (`src/endpoints/agent/chat.ts:409`)
   - Calls `chatWithExerciseHelper()` → Gemini chat
   - Background: `extractMemoryCandidates()` → OpenAI extraction
   - Background: `runSummaryMaintenance()` → OpenAI summary
   - Background: `retrieveMemoryItems()` → OpenAI embeddings

2. **Image Import** (`src/app/api/exercises/import/route.ts`)
   - Calls `extractFromImage()` → Gemini vision

3. **Memory Extraction** (`src/lib/ai/memory-extraction.ts:143-152`)
   - Direct OpenAI call for extraction
   - Calls `generateEmbeddings()` for vector creation

4. **Summary Generation** (`src/lib/ai/summary.ts:121-129`)
   - Direct OpenAI call for summarization

5. **Embeddings** (`src/lib/ai/embeddings.ts:55-57, 102-105`)
   - Direct OpenAI calls (single and batch)

6. **Vector Search Query** (`src/lib/ai/vector-search.ts`)
   - Calls `generateEmbedding()` for query embedding

---

## Implementation Tasks

### Phase 1: AIUsage Collection (D1)

**Task 1.1: Create AIUsage Payload Collection**

File: `src/collections/AIUsage.ts`

```typescript
/**
 * AIUsage Collection
 * Tracks all AI operations for cost, latency, and rate limiting
 *
 * IMPORTANT: Collection slug is explicitly set to 'ai_usage'.
 * All gateway code MUST use this exact slug.
 */
export const AIUsage: CollectionConfig = {
  slug: 'ai_usage', // EXPLICIT - do not change without updating all references
  // ...
}

// Fields
- user: relationship to users (required, indexed) // Field name is 'user', not 'userId'
- conversationId: text (optional, indexed)
- operation: select enum [chat, embedding, extraction, summary, vision]
- provider: select enum [gemini, openai]
- model: text (required)
- inputTokens: number (nullable)
- outputTokens: number (nullable)
- estimatedCostUsd: number (nullable)
- latencyMs: number (required)
- status: select enum [success, error, blocked]
- errorType: select enum [timeout, provider_error, validation_error, rate_limited, unknown] (optional)
- errorMessage: text (optional, max 500 chars)
- metadata: json (optional) - { lessonId?, exerciseId?, contextPolicyVersion?, promptVersion?, batchSize? }
- createdAt: auto timestamp
```

**CRITICAL: Field naming convention**

- The user field is named `user` (Payload relationship convention)
- Gateway code passes `userId` string, writer converts to `user` relationship
- Rate limiter queries use `user` field (the relationship), not `userId`

Access control:

- `create`: Admin only (server-side writes via overrideAccess)
- `read`: Admin only
- `update`: None (records are immutable)
- `delete`: Admin only

Indexes:

- Compound: `user + createdAt` (for rate limiting queries)
- `operation` (for filtering)
- `status` (for filtering)

**Task 1.2: Register Collection in Payload Config**

File: `src/payload.config.ts`

- Add AIUsage to collections array

**Task 1.3: Generate Types**

```bash
pnpm generate:types
```

---

### Phase 2: Pricing Configuration

**Task 2.1: Create Pricing Config**

File: `src/lib/ai/pricing.ts`

```typescript
/**
 * AI Pricing Configuration
 *
 * IMPORTANT: Only include verified pricing. Use null for unknown prices.
 * Do NOT use placeholder/estimated values.
 */

export const AI_PRICING: Record<
  string,
  Record<string, { inputPer1k: number; outputPer1k: number } | null>
> = {
  openai: {
    'gpt-4o-mini': {
      inputPer1k: 0.00015,
      outputPer1k: 0.0006,
    },
    'text-embedding-3-small': {
      inputPer1k: 0.00002,
      outputPer1k: 0, // Embeddings don't have output tokens
    },
  },
  gemini: {
    // Pricing not verified - set to null until confirmed
    'gemini-2.0-flash-001': null,
  },
} as const

export type Provider = 'openai' | 'gemini'

/**
 * Calculate cost based on actual token usage.
 * Returns null if:
 * - Tokens are not available (null input)
 * - Model pricing is not configured
 * - Provider/model not found in config
 */
export function calculateCost(
  provider: Provider,
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  // Return null if no token data
  if (inputTokens === null && outputTokens === null) {
    return null
  }

  const providerPricing = AI_PRICING[provider]
  if (!providerPricing) return null

  const modelPricing = providerPricing[model]
  if (!modelPricing) return null // Model not in config or explicitly null

  const inputCost = (inputTokens ?? 0) * (modelPricing.inputPer1k / 1000)
  const outputCost = (outputTokens ?? 0) * (modelPricing.outputPer1k / 1000)

  return inputCost + outputCost
}
```

---

### Phase 3: AI Gateway v0 (D2)

**Task 3.1: Create Gateway Types**

File: `src/lib/ai/gateway/types.ts`

```typescript
export type AIOperation = 'chat' | 'embedding' | 'extraction' | 'summary' | 'vision'
export type AIProvider = 'gemini' | 'openai'
export type AIStatus = 'success' | 'error' | 'blocked'
export type AIErrorType =
  | 'timeout'
  | 'provider_error'
  | 'validation_error'
  | 'rate_limited'
  | 'unknown'

export interface AIGatewayRequest {
  operation: AIOperation
  provider: AIProvider
  model: string
  userId: string
  conversationId?: string
  metadata?: {
    lessonId?: string
    exerciseId?: string
    contextPolicyVersion?: string
    promptVersion?: string
    batchSize?: number // For batch operations
  }
}

/**
 * Gateway response - ALWAYS returned, NEVER throws.
 * Check response.success to determine outcome.
 */
export interface AIGatewayResponse<T> {
  success: boolean
  data?: T
  error?: {
    type: AIErrorType
    message: string
  }
  usage: {
    inputTokens: number | null
    outputTokens: number | null
    estimatedCostUsd: number | null
    latencyMs: number
  }
}

/**
 * Result from executor function.
 * Provider should return actual token counts when available.
 */
export interface ExecutorResult<T> {
  data: T
  inputTokens: number | null // Use actual provider data, not estimates
  outputTokens: number | null // Use actual provider data, not estimates
}
```

**Task 3.2: Create Rate Limiter**

File: `src/lib/ai/gateway/rate-limiter.ts`

```typescript
import type { Payload } from 'payload'

export interface RateLimitConfig {
  requestsPerMinute: number // 60
  requestsPerHour: number // 500
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 60,
  requestsPerHour: 500,
}

export interface RateLimitResult {
  allowed: boolean
  reason?: 'minute_limit' | 'hour_limit'
  counts: {
    minute: number
    hour: number
  }
}

/**
 * Check if user is within rate limits.
 *
 * IMPORTANT: This is best-effort, non-atomic rate limiting.
 * Race conditions between concurrent requests are acceptable in Stage 1.
 * A user may occasionally exceed limits by a small margin under high concurrency.
 *
 * All queries use overrideAccess: true for server-level access since
 * AIUsage collection has admin-only read access.
 *
 * POLICY: Counts ALL statuses (success, error, blocked) - blocked requests
 * count toward limits to prevent abuse via spamming blocked requests.
 */
export async function checkRateLimit(
  payload: Payload,
  userId: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMITS,
): Promise<RateLimitResult> {
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  // Query counts in parallel
  // CRITICAL: Use overrideAccess: true - AIUsage is admin-only
  // CRITICAL: Field is 'user' (relationship), not 'userId'
  // POLICY: No status filter - blocked requests count toward limits
  const [minuteResult, hourResult] = await Promise.all([
    payload.count({
      collection: 'ai_usage',
      where: {
        and: [
          { user: { equals: userId } }, // 'user' is the relationship field name
          { createdAt: { greater_than: oneMinuteAgo.toISOString() } },
        ],
      },
      overrideAccess: true, // Server-level access required
    }),
    payload.count({
      collection: 'ai_usage',
      where: {
        and: [
          { user: { equals: userId } }, // 'user' is the relationship field name
          { createdAt: { greater_than: oneHourAgo.toISOString() } },
        ],
      },
      overrideAccess: true, // Server-level access required
    }),
  ])

  const minuteCount = minuteResult.totalDocs
  const hourCount = hourResult.totalDocs

  // Check limits
  if (minuteCount >= config.requestsPerMinute) {
    return {
      allowed: false,
      reason: 'minute_limit',
      counts: { minute: minuteCount, hour: hourCount },
    }
  }

  if (hourCount >= config.requestsPerHour) {
    return {
      allowed: false,
      reason: 'hour_limit',
      counts: { minute: minuteCount, hour: hourCount },
    }
  }

  return {
    allowed: true,
    counts: { minute: minuteCount, hour: hourCount },
  }
}
```

**Task 3.3: Create Gateway Core**

File: `src/lib/ai/gateway/gateway.ts`

```typescript
import type { Payload } from 'payload'
import { logger } from '@/utilities/logger'
import { calculateCost } from '../pricing'
import { classifyError } from './error-classifier'
import { checkRateLimit } from './rate-limiter'
import type { AIGatewayRequest, AIGatewayResponse, ExecutorResult } from './types'
import { writeAIUsage } from './usage-writer'

/**
 * Execute an AI operation through the gateway.
 *
 * CONTRACT: This function NEVER throws. It always returns an AIGatewayResponse.
 * - On success: { success: true, data: T, usage: {...} }
 * - On rate limit: { success: false, error: { type: 'rate_limited', ... }, usage: {...} }
 * - On provider error: { success: false, error: { type: '...', ... }, usage: {...} }
 *
 * AIUsage record is ALWAYS written before returning.
 */
export async function executeAIOperation<T>(
  payload: Payload,
  request: AIGatewayRequest,
  executor: () => Promise<ExecutorResult<T>>,
): Promise<AIGatewayResponse<T>> {
  const startTime = Date.now()

  // 1. Check rate limits (best-effort, may have race conditions)
  let rateLimitResult
  try {
    rateLimitResult = await checkRateLimit(payload, request.userId)
  } catch (rateLimitError) {
    // Rate limit check failed - log and continue (fail open)
    logger.warn(
      { err: rateLimitError, userId: request.userId },
      '[AIGateway] Rate limit check failed, proceeding with request',
    )
    rateLimitResult = { allowed: true, counts: { minute: 0, hour: 0 } }
  }

  if (!rateLimitResult.allowed) {
    const latencyMs = Date.now() - startTime

    // Write blocked record
    await writeAIUsage(payload, {
      ...request,
      status: 'blocked',
      errorType: 'rate_limited',
      errorMessage: `Rate limit exceeded: ${rateLimitResult.reason}`,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs,
    })

    return {
      success: false,
      error: {
        type: 'rate_limited',
        message: `Rate limit exceeded (${rateLimitResult.reason}). Minute: ${rateLimitResult.counts.minute}, Hour: ${rateLimitResult.counts.hour}`,
      },
      usage: {
        inputTokens: null,
        outputTokens: null,
        estimatedCostUsd: null,
        latencyMs,
      },
    }
  }

  // 2. Execute provider call
  try {
    const result = await executor()
    const latencyMs = Date.now() - startTime

    // Calculate cost using actual token data (not estimates)
    const estimatedCostUsd = calculateCost(
      request.provider,
      request.model,
      result.inputTokens,
      result.outputTokens,
    )

    // 3. Write success record
    await writeAIUsage(payload, {
      ...request,
      status: 'success',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd,
      latencyMs,
    })

    return {
      success: true,
      data: result.data,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd,
        latencyMs,
      },
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorType = classifyError(error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    // 4. Write error record
    await writeAIUsage(payload, {
      ...request,
      status: 'error',
      errorType,
      errorMessage: errorMessage.slice(0, 500), // Truncate to 500 chars
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs,
    })

    // Return error response (DO NOT throw)
    return {
      success: false,
      error: {
        type: errorType,
        message: errorMessage,
      },
      usage: {
        inputTokens: null,
        outputTokens: null,
        estimatedCostUsd: null,
        latencyMs,
      },
    }
  }
}
```

**Task 3.4: Create Error Classifier**

File: `src/lib/ai/gateway/error-classifier.ts`

```typescript
import type { AIErrorType } from './types'

/**
 * Classify an error into a standard error type.
 * Used for consistent error categorization in AIUsage records.
 */
export function classifyError(error: unknown): AIErrorType {
  if (!error) return 'unknown'

  const err = error as Record<string, unknown>
  const message = (err.message as string) || ''
  const code = err.code as string | undefined
  const status = err.status as number | undefined

  // Timeout detection
  if (message.toLowerCase().includes('timed out')) return 'timeout'
  if (message.toLowerCase().includes('timeout')) return 'timeout'
  if (code === 'ETIMEDOUT') return 'timeout'
  if (code === 'ECONNABORTED') return 'timeout'

  // Provider errors (HTTP 5xx, rate limits from provider)
  if (status && status >= 500) return 'provider_error'
  if (code === 'rate_limit_exceeded') return 'provider_error'
  if (message.includes('rate limit')) return 'provider_error'
  if (message.includes('quota exceeded')) return 'provider_error'
  if (message.includes('service unavailable')) return 'provider_error'

  // Validation errors (HTTP 4xx, schema errors)
  if (status && status >= 400 && status < 500) return 'validation_error'
  if (message.includes('invalid')) return 'validation_error'
  if (message.includes('required')) return 'validation_error'

  return 'unknown'
}
```

**Task 3.5: Create AIUsage Writer**

File: `src/lib/ai/gateway/usage-writer.ts`

```typescript
import type { Payload } from 'payload'
import { logger } from '@/utilities/logger'
import type { AIErrorType, AIOperation, AIProvider, AIStatus } from './types'

export interface AIUsageData {
  userId: string
  conversationId?: string
  operation: AIOperation
  provider: AIProvider
  model: string
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostUsd: number | null
  latencyMs: number
  status: AIStatus
  errorType?: AIErrorType
  errorMessage?: string
  metadata?: Record<string, unknown>
}

/**
 * Write an AIUsage record.
 * Uses overrideAccess: true for server-side writes.
 *
 * This function should never throw - errors are logged but swallowed
 * to ensure the main operation can complete.
 */
export async function writeAIUsage(payload: Payload, data: AIUsageData): Promise<void> {
  try {
    await payload.create({
      collection: 'ai_usage',
      data: {
        user: data.userId, // Relationship field
        conversationId: data.conversationId,
        operation: data.operation,
        provider: data.provider,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        estimatedCostUsd: data.estimatedCostUsd,
        latencyMs: data.latencyMs,
        status: data.status,
        errorType: data.errorType,
        errorMessage: data.errorMessage,
        metadata: data.metadata,
      },
      overrideAccess: true, // Server-side write, bypass access control
    })
  } catch (error) {
    // Log but don't throw - AIUsage write failure shouldn't break the operation
    logger.error({ err: error, data }, '[AIGateway] Failed to write AIUsage record')
  }
}
```

**Task 3.6: Create Gateway Index**

File: `src/lib/ai/gateway/index.ts`

```typescript
export { executeAIOperation } from './gateway'
export { checkRateLimit, DEFAULT_RATE_LIMITS } from './rate-limiter'
export { classifyError } from './error-classifier'
export { writeAIUsage } from './usage-writer'
export type {
  AIOperation,
  AIProvider,
  AIStatus,
  AIErrorType,
  AIGatewayRequest,
  AIGatewayResponse,
  ExecutorResult,
} from './types'
```

---

### Phase 4: Integrate Gateway into Call Sites

**Task 4.1: Wrap Gemini Chat**

File: `src/lib/ai/services/exercise-chat-service.ts`

```typescript
// Update chatWithExerciseHelper to accept payload and userId
export async function chatWithExerciseHelperTracked(
  payload: Payload,
  userId: string,
  input: ChatInput,
  metadata?: { lessonId?: string; exerciseId?: string; conversationId?: string },
): Promise<ChatResult> {
  const response = await executeAIOperation(
    payload,
    {
      operation: 'chat',
      provider: 'gemini',
      model: AI_MODELS.EXERCISE_CHAT.name,
      userId,
      conversationId: metadata?.conversationId,
      metadata: {
        lessonId: metadata?.lessonId,
        exerciseId: metadata?.exerciseId,
      },
    },
    async () => {
      const result = await generateChatCompletion(input)
      // Gemini doesn't return token counts - use null (not estimates)
      return {
        data: result,
        inputTokens: null,
        outputTokens: null,
      }
    },
  )

  if (!response.success) {
    return {
      success: false,
      error: response.error?.message ?? 'Unknown error',
    }
  }

  return {
    success: true,
    message: response.data?.text,
  }
}
```

**Task 4.2: Wrap OpenAI Embeddings**

File: `src/lib/ai/embeddings.ts`

**Type update required:**

```typescript
// Update EmbeddingResult interface to make tokensUsed nullable
export interface EmbeddingResult {
  embedding: number[]
  model: string
  tokensUsed: number | null // Changed from number - null in batch mode
}
```

```typescript
/**
 * Generate embedding with gateway tracking.
 * Uses actual token data from OpenAI response.
 */
export async function generateEmbeddingTracked(
  payload: Payload,
  userId: string,
  text: string,
  conversationId?: string,
): Promise<AIGatewayResponse<EmbeddingResult>> {
  return executeAIOperation(
    payload,
    {
      operation: 'embedding',
      provider: 'openai',
      model: EMBEDDING_MODEL,
      userId,
      conversationId,
    },
    async () => {
      const client = getOpenAIClient()
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.trim(),
      })

      const embedding = response.data[0].embedding
      if (embedding.length !== EXPECTED_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`,
        )
      }

      return {
        data: {
          embedding,
          model: response.model,
          tokensUsed: response.usage.total_tokens,
        },
        // Use actual token data from OpenAI
        inputTokens: response.usage.total_tokens,
        outputTokens: 0, // Embeddings have no output tokens
      }
    },
  )
}

/**
 * Batch embedding with gateway tracking.
 * Single AIUsage record for entire batch.
 * If any item fails, entire operation fails.
 *
 * NOTE: Per-item tokensUsed is set to null because OpenAI only returns
 * total tokens for the batch, not per-item breakdown. The actual total
 * is recorded in the AIUsage record via inputTokens.
 */
export async function generateEmbeddingsTracked(
  payload: Payload,
  userId: string,
  texts: string[],
  conversationId?: string,
): Promise<AIGatewayResponse<EmbeddingResult[]>> {
  const validTexts = texts.filter((t) => t && t.trim().length > 0)
  if (validTexts.length === 0) {
    return {
      success: true,
      data: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, latencyMs: 0 },
    }
  }

  return executeAIOperation(
    payload,
    {
      operation: 'embedding',
      provider: 'openai',
      model: EMBEDDING_MODEL,
      userId,
      conversationId,
      metadata: { batchSize: validTexts.length },
    },
    async () => {
      const client = getOpenAIClient()
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: validTexts.map((t) => t.trim()),
      })

      // Validate all embeddings
      // NOTE: tokensUsed is null for batch - we don't have per-item breakdown
      const results: EmbeddingResult[] = response.data.map((item) => {
        if (item.embedding.length !== EXPECTED_DIMENSIONS) {
          throw new Error(
            `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${item.embedding.length}`,
          )
        }
        return {
          embedding: item.embedding,
          model: response.model,
          tokensUsed: null, // Per-item tokens unavailable in batch mode
        }
      })

      return {
        data: results,
        // Use actual total token count from OpenAI (recorded in AIUsage)
        inputTokens: response.usage.total_tokens,
        outputTokens: 0,
      }
    },
  )
}
```

**Task 4.3: Wrap OpenAI Summary**

File: `src/lib/ai/summary.ts`

```typescript
/**
 * Generate summary with gateway tracking.
 * Uses actual prompt_tokens/completion_tokens from OpenAI response.
 */
export async function generateSummaryTracked(
  payload: Payload,
  userId: string,
  conversationId: string,
  existingSummary: string,
  messagesToSummarize: Message[],
): Promise<AIGatewayResponse<SummaryResult>> {
  return executeAIOperation(
    payload,
    {
      operation: 'summary',
      provider: 'openai',
      model: 'gpt-4o-mini',
      userId,
      conversationId,
    },
    async () => {
      const messagesText = messagesToSummarize
        .map((msg) => `[${new Date(msg.timestamp).toISOString()}] ${msg.role}: ${msg.content}`)
        .join('\n\n')

      let userPrompt = ''
      if (existingSummary && existingSummary.trim().length > 0) {
        userPrompt = `Here is the existing summary:\n\n${existingSummary}\n\n---\n\nHere are new messages to incorporate:\n\n${messagesText}\n\n---\n\nPlease update the summary to include the new information.`
      } else {
        userPrompt = `Here are the messages to summarize:\n\n${messagesText}\n\n---\n\nPlease create a summary.`
      }

      const client = getOpenAIClient()
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      })

      const summary = response.choices[0].message.content || ''
      const lastMessage = messagesToSummarize[messagesToSummarize.length - 1]

      return {
        data: {
          summary,
          summaryUntilTimestamp: new Date(lastMessage.timestamp),
          tokensUsed: response.usage?.total_tokens || 0,
        },
        // Use actual token data from OpenAI - DO NOT estimate
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
      }
    },
  )
}
```

**Task 4.4: Wrap OpenAI Memory Extraction**

File: `src/lib/ai/memory-extraction.ts`

```typescript
/**
 * Extract memory candidates with gateway tracking.
 * Uses actual token data from OpenAI response.
 */
export async function extractMemoryCandidatesTracked(
  payload: Payload,
  userId: string,
  conversationId: string,
  recentMessages: Message[],
  existingSummary?: string,
): Promise<AIGatewayResponse<MemoryCandidate[]>> {
  return executeAIOperation(
    payload,
    {
      operation: 'extraction',
      provider: 'openai',
      model: 'gpt-4o-mini',
      userId,
      conversationId,
    },
    async () => {
      const messagesText = recentMessages
        .slice(-10)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n\n')

      let userPrompt = `Recent messages:\n\n${messagesText}`
      if (existingSummary) {
        userPrompt = `Conversation summary:\n${existingSummary}\n\n---\n\n${userPrompt}`
      }

      const client = getOpenAIClient()
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')
      const filtered = filterMemoryCandidates(result.memories || [])

      return {
        data: filtered,
        // Use actual token data from OpenAI
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
      }
    },
  )
}
```

**Task 4.5: Wrap Gemini Vision**

File: `src/lib/ai/services/data-extractor-service.ts`

```typescript
/**
 * Extract from image with gateway tracking.
 * Gemini doesn't return token counts - stores null.
 */
export async function extractFromImageTracked(
  payload: Payload,
  userId: string,
  input: ImageToExerciseInput,
): Promise<AIGatewayResponse<ImageToExerciseResponse>> {
  return executeAIOperation(
    payload,
    {
      operation: 'vision',
      provider: 'gemini',
      model: AI_MODELS.IMAGE_TO_EXERCISE.name,
      userId,
    },
    async () => {
      const result = await extractFromImage(input)
      return {
        data: result,
        // Gemini doesn't return token counts - use null (not estimates)
        inputTokens: null,
        outputTokens: null,
      }
    },
  )
}
```

**Task 4.6: Update Chat Endpoint**

File: `src/endpoints/agent/chat.ts`

Key changes:

- Pass `payload` and `userId` explicitly to all AI operations
- Capture userId before background operations start
- Use tracked versions of all AI calls

```typescript
// BEFORE background task
const currentUserId = req.user.id // Capture before background
const currentConversationId = conversationId

// Background operations explicitly pass userId
runSummaryMaintenanceTracked(req.payload, currentUserId, currentConversationId)
  .catch((err) => reqLogger.error({ err }, 'Summary maintenance failed'))

// Memory extraction with explicit userId
extractMemoryCandidatesTracked(req.payload, currentUserId, currentConversationId, messageList, summary)
  .then(...)
```

**Task 4.7: Update Image Import Endpoint**

File: `src/app/api/exercises/import/route.ts`

- Use `extractFromImageTracked()` instead
- Pass `userId` from authenticated request

---

### Phase 5: Admin Visibility (D4)

**Task 5.1: Configure Admin List View**

File: `src/collections/AIUsage.ts`

```typescript
admin: {
  useAsTitle: 'operation',
  defaultColumns: ['user', 'operation', 'provider', 'model', 'status', 'latencyMs', 'createdAt'],
  listSearchableFields: ['conversationId'],
  group: 'System',
}
```

**Task 5.2: Create Daily Summary Utility**

File: `src/lib/ai/gateway/daily-summary.ts`

```typescript
/**
 * Get daily usage summary.
 * Uses overrideAccess: true for server-level access.
 */
export async function getDailySummary(payload: Payload, date: Date): Promise<DailySummary> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  // Query with server access
  const result = await payload.find({
    collection: 'ai_usage',
    where: {
      and: [
        { createdAt: { greater_than_equal: startOfDay.toISOString() } },
        { createdAt: { less_than_equal: endOfDay.toISOString() } },
      ],
    },
    limit: 10000, // Reasonable limit for daily aggregation
    overrideAccess: true, // Server-level access required
  })

  // Aggregate in code (could use MongoDB aggregation for scale)
  return aggregateUsage(result.docs, date)
}
```

---

### Phase 6: Testing & Verification

**Task 6.1: Unit Tests for Rate Limiter**

File: `tests/int/ai-gateway/rate-limiter.int.spec.ts`

- Test minute limit enforcement
- Test hour limit enforcement
- Test blocked record creation
- Test that overrideAccess is used (mock payload.count)

**Task 6.2: Unit Tests for Error Classifier**

File: `tests/unit/ai-gateway/error-classifier.spec.ts`

- Test timeout detection (various patterns)
- Test provider error detection
- Test validation error detection
- Test unknown fallback

**Task 6.3: Integration Tests for Gateway**

File: `tests/int/ai-gateway/gateway.int.spec.ts`

- Test successful operation creates AIUsage record
- Test error operation creates AIUsage with error details
- Test rate limit blocks before provider call
- Test gateway never throws (always returns response)
- Test AIUsage write failure doesn't break operation

**Task 6.4: Token Accounting Tests**

File: `tests/int/ai-gateway/token-accounting.int.spec.ts`

- Test OpenAI operations capture actual prompt_tokens/completion_tokens
- Test Gemini operations store null (not estimates)
- Test batch embeddings use total token count

---

## File Summary

### New Files

| File                                     | Purpose                       |
| ---------------------------------------- | ----------------------------- |
| `src/collections/AIUsage.ts`             | Payload collection definition |
| `src/lib/ai/pricing.ts`                  | Cost estimation configuration |
| `src/lib/ai/gateway/types.ts`            | Gateway type definitions      |
| `src/lib/ai/gateway/gateway.ts`          | Core gateway implementation   |
| `src/lib/ai/gateway/rate-limiter.ts`     | Payload-based rate limiting   |
| `src/lib/ai/gateway/error-classifier.ts` | Error type classification     |
| `src/lib/ai/gateway/usage-writer.ts`     | AIUsage record creation       |
| `src/lib/ai/gateway/daily-summary.ts`    | Daily aggregation utility     |
| `src/lib/ai/gateway/index.ts`            | Public exports                |

### Modified Files

| File                                            | Changes                                      |
| ----------------------------------------------- | -------------------------------------------- |
| `src/payload.config.ts`                         | Register AIUsage collection                  |
| `src/lib/ai/services/exercise-chat-service.ts`  | Add `*Tracked` version                       |
| `src/lib/ai/embeddings.ts`                      | Add `*Tracked` versions (single + batch)     |
| `src/lib/ai/summary.ts`                         | Add `*Tracked` version                       |
| `src/lib/ai/memory-extraction.ts`               | Add `*Tracked` version                       |
| `src/lib/ai/services/data-extractor-service.ts` | Add `*Tracked` version                       |
| `src/endpoints/agent/chat.ts`                   | Use tracked operations, explicit userId      |
| `src/app/api/exercises/import/route.ts`         | Use tracked vision                           |
| `src/lib/ai/maintenance.ts`                     | Accept payload/userId parameters             |
| `src/lib/ai/vector-search.ts`                   | Accept payload/userId for embedding tracking |

---

## Milestones

| Milestone | Tasks         | Verification                               |
| --------- | ------------- | ------------------------------------------ |
| **M1**    | 1.1, 1.2, 1.3 | AIUsage collection exists, types generated |
| **M2**    | 2.1, 3.1-3.6  | Gateway implemented, can be called         |
| **M3**    | 4.1-4.7       | All call sites routed through gateway      |
| **M4**    | 5.1-5.2       | Admin can filter and view summaries        |
| **M5**    | 6.1-6.4       | All acceptance criteria verified           |

---

## Acceptance Criteria Verification

| AC                                                                        | How Verified                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| **AC1**: Every AI operation produces exactly one AIUsage record           | Integration test: call each operation, count records     |
| **AC2**: Rate limits block without hitting providers                      | Unit test: mock provider, verify not called when blocked |
| **AC3**: latencyMs is present and non-null for all records                | DB query: `find where latencyMs is null` returns 0       |
| **AC4**: Error classification distinguishes timeout/provider/rate_limited | Unit tests for error classifier                          |
| **AC5**: Admin UI supports filtering                                      | Manual verification in Payload Admin                     |

---

## Done Criteria (from Fixes Required)

- [x] Gateway behavior is deterministic (always returns, never throws)
- [x] Rate limiting uses `overrideAccess: true` and is documented as best-effort
- [x] Token data uses actual provider values (prompt_tokens/completion_tokens)
- [x] No fabricated pricing data (Gemini pricing = null)
- [x] Batch embeddings = single atomic operation
- [x] Background operations receive explicit userId
- [x] AIUsage collection has explicit `slug: 'ai_usage'`
- [x] User field is consistently named `user` (relationship), queries use `user` not `userId`
- [x] Rate limit counting policy documented: blocked requests COUNT toward limits
- [x] Batch embeddings: per-item `tokensUsed = null` (no fake per-item token numbers)
- [x] Rate limit failure policy documented: fail-open with logging (abuse risk acknowledged)

---

## Risk Mitigation

| Risk                            | Mitigation                                              |
| ------------------------------- | ------------------------------------------------------- |
| Rate limit queries slow         | Add compound index on (userId, createdAt)               |
| Rate limit check fails          | Fail open with logging (don't block user)               |
| AIUsage write fails             | Log and continue (don't break the operation)            |
| High write volume               | Batch writes if needed (not expected in Stage 1)        |
| Gateway adds latency            | Keep minimal - just timing, rate check, and async write |
| Breaking existing functionality | Keep original functions, add `*Tracked` versions        |
