# LLM Infrastructure

**@domain** ai
**@fileType** infrastructure
**@ai-summary** LLM providers, embeddings, vector search, and AI services

---

## Architecture Overview

```
src/infra/llm/
├── index.ts                      # Public API exports
├── models.ts                     # AI model configurations
├── providers/                    # LLM provider implementations
│   ├── factory.ts               # Provider abstraction + runtime switching
│   ├── gemini/                  # Google Gemini provider
│   └── openai/                  # OpenAI-compatible provider
├── services/                    # High-level AI services
│   ├── data-extractor-service.ts
│   ├── exercise-chat-service.ts
│   └── image-optimizer-service.ts
├── embeddings.ts                # Text embeddings for vector search
├── vector-search.ts             # Vector database operations
├── doc-search.ts                # Documentation search
├── smart-doc-loader.ts          # Context-aware doc loading
├── observability.ts             # AI telemetry + metrics
├── prompt-composer.server.ts    # Prompt template composition
├── prompt-resolver.server.ts    # Prompt resolution logic
├── system-prompts.server.ts     # System prompt management
├── lesson-context.ts            # Lesson context injection
├── memory-extraction.ts         # Memory extraction from chat
├── summary.ts                   # Conversation summarization
└── multimodal/                  # Multimodal (image) processing
```

---

## Providers

### Provider Factory

**File:** [`providers/factory.ts`](providers/factory.ts)

Unified interface for switching between LLM providers at runtime.

```typescript
import { getLLMProvider, detectBestProvider, LLMProviderType } from './providers/factory'

// Get provider based on LLM_PROVIDER env var
const provider = await getLLMProvider(payload)

// Auto-detect best available provider
const bestProvider = await detectBestProvider(payload)
```

**Environment Variables:**

- `LLM_PROVIDER` - Provider selection: `gemini` (default) or `openai-compatible`
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_COMPATIBLE_API_KEY` - OpenAI-compatible API key
- `OPENAI_COMPATIBLE_BASE_URL` - Custom endpoint for OpenAI-compatible providers

### Gemini Provider

**Files:** [`providers/gemini/`](providers/gemini/)

```typescript
import { generateChatCompletion, isGeminiApiKeyConfigured } from './providers/gemini'

const configured = await isGeminiApiKeyConfigured(payload)
```

### OpenAI-Compatible Provider

**Files:** [`providers/openai/`](providers/openai/)

```typescript
import { generateChatCompletion, isOpenAIApiKeyConfigured } from './providers/openai'

const configured = await isOpenAIApiKeyConfigured(payload)
```

---

## Model Configurations

**File:** [`models.ts`](models.ts)

Centralized model selection and parameters.

```typescript
import { AI_MODELS } from '@/infra/llm/models'

const config = AI_MODELS.IMAGE_TO_EXERCISE
// { name: 'gemini-2.0-flash-001', temperature: 0.2, maxOutputTokens: 8192 }
```

| Model Key           | Model                | Temperature | Max Tokens | Use Case                   |
| ------------------- | -------------------- | ----------- | ---------- | -------------------------- |
| `IMAGE_TO_EXERCISE` | gemini-2.0-flash-001 | 0.2         | 8192       | Structured JSON extraction |
| `EXERCISE_CHAT`     | gemini-2.0-flash-001 | 0.7         | 2048       | Conversational chat        |
| `PDF_TO_EXERCISE`   | gemini-2.0-flash-001 | 0.1         | 8192       | PDF parsing                |

---

## Services

### Data Extractor Service

Extract structured exercise data from images.

```typescript
import { extractFromImage } from '@/infra/llm/services/data-extractor-service'

const result = await extractFromImage({
  imageBuffer: file.buffer,
  mimeType: 'image/png',
})
```

### Exercise Chat Service

Conversational assistance for students.

```typescript
import { chatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'

const result = await chatWithExerciseHelper({
  message: "I don't understand this problem",
  acknowledgment: "I'll help guide you step by step.",
})
```

### Image Optimizer Service

Optimize images for AI processing.

```typescript
import { optimizeImageForAI } from '@/infra/llm/services/image-optimizer-service'

const optimized = await optimizeImageForAI(buffer, 2048)
```

---

## Vector Search

### Embeddings

**File:** [`embeddings.ts`](embeddings.ts)

Generate text embeddings for similarity search.

### Vector Search

**File:** [`vector-search.ts`](vector-search.ts)

```typescript
import { vectorSearch, upsertMemoryVector, deleteMemoryVector } from '@/infra/llm/vector-search'

// Search for similar memories
const results = await vectorSearch(query, { limit: 5 })

// Upsert memory embedding
await upsertMemoryVector(memoryId, text, metadata)

// Delete memory embedding
await deleteMemoryVector(memoryId)
```

### Doc Search

**File:** [`doc-search.ts`](doc-search.ts)

Documentation keyword search with scoring.

```typescript
import { getDocSearch } from '@/infra/llm/doc-search'

const search = getDocSearch()
const results = search.query('access control patterns')
```

### Smart Doc Loader

**File:** [`smart-doc-loader.ts`](smart-doc-loader.ts)

Context-aware documentation loading for AI agents.

```typescript
import { SmartDocLoader } from '@/infra/llm/smart-doc-loader'

const docs = SmartDocLoader.forCollection('create') // ~380 tokens
```

---

## Observability

**File:** [`observability.ts`](observability.ts)

AI telemetry, metrics, and tracing.

```typescript
import { observability } from '@/infra/llm/observability'

// Record a trace
await observability.recordTrace({
  name: 'chat-completion',
  input: messages,
  output: response,
  metadata: { model, duration: 1234 },
})
```

---

## Prompts

**Directory:** [`prompts/`](prompts/)

System prompts for different AI tasks.

| File                                         | Purpose              |
| -------------------------------------------- | -------------------- |
| `prompts/exercise-chat-agent-prompt.md`      | Exercise chat agent  |
| `prompts/memory-extraction-system-prompt.md` | Memory extraction    |
| `prompts/summary-system-prompt.md`           | Conversation summary |

---

## Agent Guardrails

### Must

- Use `getLLMProvider()` for all LLM operations (singleton pattern)
- Use `AI_MODELS` for model configurations (no magic strings)
- Pass `payload` to provider methods for proper access control
- Handle errors gracefully with `try/catch` and return structured responses

### Must Not

- Create multiple LLM client instances (use singleton)
- Hardcode model names or temperatures
- Expose API keys in client code
- Call providers without `payload` context

### Should

- Use structured responses `{ success, data, error, metadata }`
- Log errors with context using logger utilities
- Validate API responses before using them
- Use `optimizeImageForAI()` before sending images

---

## Related Documentation

- [`AGENTS.md`](../../../AGENTS.md) - Complete Payload patterns
- [`docs/ai-services/README.md`](../../../docs/ai-services/README.md) - AI services guide
- [`docs/ai/README.md`](../../../docs/ai/README.md) - AI documentation overview

---

## Quick Reference

```typescript
// Import everything from the public API
import {
  generateChatCompletion,
  getLLMProvider,
  AI_MODELS,
  extractFromImage,
  chatWithExerciseHelper,
  vectorSearch,
  getDocSearch,
} from '@/infra/llm'
```
