# Plan: Replace LLM Management with Genkit

## Overview

Replace the existing in-house LLM access layer with [Firebase Genkit](https://github.com/firebase/genkit) as the unified model interface, while keeping ConfigValues as the source of truth for runtime configuration.

---

## Current Architecture Summary

### LLM Layer Structure
```
src/infra/llm/
├── models.ts                    # MODEL_REGISTRY, PROVIDER_MODEL_NAMES, AIModelKey
├── providers/
│   ├── factory.ts               # getLLMProvider(), getProviderTypeFromEnv(), UnifiedLLMProvider
│   ├── types.ts                 # LLMProviderType enum (GEMINI, OPENAI_COMPATIBLE)
│   ├── gemini/                  # Gemini SDK wrapper
│   ├── openai-compatible/       # OpenAI-compatible SDK wrapper
│   └── shared/
│       ├── chat-config.ts       # ChatConfig interface, getChatConfig(), getModelConfig()
│       ├── retry.ts             # withRetry() exponential backoff
│       └── errors.ts            # LLMError, error classification
└── services/
    ├── exercise-chat-service.ts # Chat with exercises
    └── data-extractor-service.ts # Image → Exercise extraction
```

### Configuration Hierarchy (Preserved)
```
Priority (highest → lowest):
1. process.env.* (LLM_PROVIDER, LLM_MODEL_OVERRIDE_*)
2. ConfigSecrets (GEMINI_API_KEY, OPENAI_COMPATIBLE_API_KEY, OPENAI_COMPATIBLE_BASE_URL)
3. ConfigValues/chat domain (models, timeouts, retry, temperature)
4. MODEL_REGISTRY defaults (hardcoded fallbacks)
```

### Current Use Cases
| Use Case | File | LLM Method |
|----------|------|------------|
| Exercise Chat | `exercise-chat-service.ts` | `generateChatCompletion` / `WithTools` |
| Image → Exercise | `data-extractor-service.ts` | `generateMultimodalCompletion` |
| PDF → Exercise (job) | `pdf-to-exercises-task.ts` | `generateMultimodalCompletion` × 2 |
| Admin Chat + Tools | `endpoints/agent/chat.ts` | `generateChatCompletionWithTools` |

---

## Architecture Decisions

### Q1: Config Shape Mapping

| ConfigValues Key | Genkit Equivalent | Action |
|------------------|-------------------|--------|
| `temperature.default` | `config.temperature` | Direct map |
| `models.*.maxOutputTokens` | `config.maxOutputTokens` | Direct map |
| `retry.*` | N/A (Genkit has no retry) | Keep `withRetry()` wrapper |
| `chatSettings.defaultChatTimeoutMs` | `config.timeout` (seconds) | Convert ms → s |
| `models.*.gemini` | `googleai/{modelName}` | Resolver prefixes |
| `models.*.openaiCompatible` | `openai/{modelName}` | Resolver prefixes |

**New keys needed**: None. Existing config is sufficient.

### Q2: Tenant Precedence

**Resolution**: Per-call (not memoized) for tenant flexibility.

```
1. Explicit tenantId parameter
2. Cached defaultTenantId
3. getDefaultTenantId(payload) fallback
```

Genkit instance initialized once per provider type. Model selection resolved per-call.

### Q3: Model Naming

**Strategy**: Keep internal `AIModelKey` identifiers. Resolver maps to Genkit format:

```typescript
// Internal key
'PDF_TO_EXERCISE'

// Resolved for Gemini
'googleai/gemini-2.0-flash-001'

// Resolved for OpenAI-compatible
'openai/MiniMax-M2.1'  // with baseURL injected in plugin config
```

### Q4: Error/Retry Policy

| Policy | Location | Genkit Strategy |
|--------|----------|-----------------|
| Retry logic | `shared/retry.ts` | **Keep** - wrap Genkit calls |
| Retryable errors | `shared/errors.ts` | **Keep** - map Genkit errors |
| Timeouts | ConfigValues | Pass to Genkit `timeout` option |

### Q5: Streaming

**Current**: No streaming in production.
**Genkit**: `ai.generateStream()` available.
**Decision**: Non-streaming for Phase 1. Add streaming later for Exercise Chat if needed.

### Q6: Multi-Provider Support

**Decision**: Single provider per tenant (current behavior preserved).

- One Genkit instance per provider type
- Tenant selects provider via `LLM_PROVIDER` in ConfigValues/global or env
- Simpler configuration model

### Q7: OpenAI-Compatible BaseURL Scope

**Decision**: Per-tenant in ConfigValues (not environment-only).

- Add `OPENAI_COMPATIBLE_BASE_URL` to ConfigSecrets (tenant-scoped)
- Allows different OpenAI-compatible endpoints per tenant
- Fallback to `process.env.OPENAI_COMPATIBLE_BASE_URL`

### Q8: Genkit DevUI

**Decision**: Yes, add DevUI for local development.

- Enable visual flow debugging and trace inspection
- Only active in development mode (`NODE_ENV !== 'production'`)
- Start with `genkit start` command

---

## Implementation Plan

### Phase 1: Foundation (Backward Compatible)

**Goal**: Create Genkit infrastructure coexisting with current system.

**New files**:
```
src/infra/llm/genkit/
├── index.ts                     # Public exports
├── config-resolver.ts           # ConfigValues → Genkit config mapping
├── genkit-instance.ts           # Singleton Genkit with lazy plugin loading
├── plugins/
│   ├── gemini-plugin.ts         # @genkit-ai/googleai setup
│   └── openai-plugin.ts         # genkitx-openai setup with baseURL
├── adapters/
│   ├── unified-adapter.ts       # UnifiedLLMProvider interface backed by Genkit
│   └── error-adapter.ts         # Genkit errors → LLMError
```

**Key implementation**:

```typescript
// config-resolver.ts
interface GenkitModelConfig {
  model: string           // 'googleai/gemini-2.0-flash-001'
  temperature: number
  maxOutputTokens: number
  timeout?: number        // seconds
}

export async function resolveGenkitConfig(
  modelKey: AIModelKey,
  tenantId?: string
): Promise<GenkitModelConfig> {
  // 1. Check LLM_MODEL_OVERRIDE_* env vars
  // 2. Load ConfigValues for tenant
  // 3. Get model name from config.models[task][provider]
  // 4. Prefix with 'googleai/' or 'openai/'
  // 5. Return complete config
}
```

```typescript
// genkit-instance.ts
import { genkit } from 'genkit'
import { googleAI } from '@genkit-ai/googleai'
import { openAI } from 'genkitx-openai'

// Cache per provider type (single provider per tenant)
const instances = new Map<LLMProviderType, Genkit>()

export async function getGenkitInstance(
  payload: Payload,
  tenantId?: string
): Promise<Genkit> {
  const providerType = await getProviderTypeFromEnv(payload)

  if (instances.has(providerType)) {
    return instances.get(providerType)!
  }

  const apiKey = await getApiKeyForProvider(providerType, payload, tenantId)
  // BaseURL now tenant-scoped via ConfigSecrets
  const baseURL = await getOpenAICompatibleBaseUrl(payload, tenantId)

  const plugins = providerType === LLMProviderType.GEMINI
    ? [googleAI({ apiKey })]
    : [openAI({ apiKey, baseURL })]

  const instance = genkit({ plugins })
  instances.set(providerType, instance)
  return instance
}
```

**Tests**:
- `config-resolver.test.ts`: All ConfigValues paths, env overrides, tenant scoping
- `genkit-instance.test.ts`: Plugin initialization, singleton behavior

---

### Phase 2: Service Migration

**Goal**: Replace direct provider calls with Genkit `generate()`.

**Files to modify**:
- `src/infra/llm/services/exercise-chat-service.ts`
- `src/infra/llm/services/data-extractor-service.ts`
- `src/infra/llm/providers/factory.ts` (backward-compat shim)

**Migration pattern**:
```typescript
// Before
const provider = await getLLMProvider(payload)
const result = await provider.generateMultimodalCompletion({
  prompt, model, attachments, timeoutMs
}, payload)

// After
const ai = await getGenkitInstance(payload)
const config = await resolveGenkitConfig('IMAGE_TO_EXERCISE', tenantId)
const result = await withRetry(() =>
  ai.generate({
    model: config.model,
    prompt: [
      { media: { url: `data:${mimeType};base64,${data}` } },
      { text: prompt }
    ],
    config: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    }
  })
)
```

**Backward compatibility shim**:
```typescript
// factory.ts - Keep getLLMProvider() working during migration
export async function getLLMProvider(payload, config?): Promise<UnifiedLLMProvider> {
  return createGenkitUnifiedAdapter(payload, config) // New adapter
}
```

**Tests**:
- Integration: Exercise chat works with Genkit backend
- Integration: Image extraction returns same format
- Regression: All existing tests pass

---

### Phase 3: Tool Calling Migration

**Goal**: Migrate MCP tools to Genkit's tool system.

**New files**:
```
src/infra/llm/genkit/tools/
├── mcp-tool-adapter.ts          # MCPTool → Genkit defineTool()
└── tool-executor.ts             # Genkit tool execution wrapper
```

**Files to modify**:
- `src/server/payload/endpoints/agent/chat.ts`

**Tool conversion**:
```typescript
import { defineTool } from 'genkit'
import { z } from 'zod'

export function mcpToolToGenkitTool(mcpTool: MCPTool, executor: ToolExecutor) {
  return defineTool({
    name: mcpTool.name,
    description: mcpTool.description,
    inputSchema: convertToZod(mcpTool.inputSchema),
    outputSchema: z.string(),
  }, async (input) => executor(mcpTool.name, input))
}
```

**Tests**:
- Unit: MCP tool → Genkit tool conversion
- Integration: Admin chat with tools end-to-end

---

### Phase 4: Background Job Flows

**Goal**: Use Genkit Flows ONLY in PDF conversion background jobs.

**New files**:
```
src/infra/llm/genkit/flows/
├── index.ts
├── pdf-extraction-flow.ts       # defineFlow for extraction
└── pdf-verification-flow.ts     # defineFlow for verification
```

**Files to modify**:
- `src/server/payload/jobs/pdf-to-exercises-task.ts`

**Flow definition**:
```typescript
// pdf-extraction-flow.ts
import { z } from 'zod'

export const pdfExtractionFlow = ai.defineFlow(
  {
    name: 'pdfExtractionFlow',
    inputSchema: z.object({
      pdfBase64: z.string(),
      pageStart: z.number(),
      pageEnd: z.number(),
      extractorPrompt: z.string(),
    }),
    outputSchema: z.array(ExerciseExtractedSchema),
  },
  async (input) => {
    const config = await resolveGenkitConfig('PDF_TO_EXERCISE')
    const result = await ai.generate({
      model: config.model,
      prompt: [
        { media: { url: `data:application/pdf;base64,${input.pdfBase64}` } },
        { text: input.extractorPrompt },
      ],
      config,
    })
    return parseExtractorResponseText(result.text)
  }
)
```

**Job integration** (Payload Jobs remains scheduler):
```typescript
// pdf-to-exercises-task.ts
import { pdfExtractionFlow, pdfVerificationFlow } from '@/infra/llm/genkit/flows'

// In handler:
const exercises = await pdfExtractionFlow({
  pdfBase64: attachments[0].data,
  pageStart: segment.pageStart,
  pageEnd: segment.pageEnd,
  extractorPrompt: input.promptSnapshot.extractor,
})

// Retry-once-then-skip logic stays in task handler (not in flow)
for (const exercise of exercises) {
  let verification = await pdfVerificationFlow({ exercise, verifierPrompt })
  if (!verification.valid) {
    verification = await pdfVerificationFlow({ exercise, verifierPrompt }) // retry once
  }
  if (!verification.valid) { skip() }
}
```

**Tests**:
- Unit: Flow schemas validate correctly
- Integration: PDF extraction flow produces valid exercises
- Integration: Full job runs with flows
- Regression: Existing PDF conversion tests pass

---

### Phase 5: Cleanup

**Goal**: Remove deprecated code, add observability.

**Files to deprecate** (not delete yet):
- `src/infra/llm/providers/gemini/gemini.provider.ts`
- `src/infra/llm/providers/gemini/gemini.client.ts`
- `src/infra/llm/providers/openai-compatible/openai.provider.ts`
- `src/infra/llm/providers/openai-compatible/openai.client.ts`

**Optimizations**:
1. Plugin caching per provider type
2. Config resolution caching with TTL
3. Genkit telemetry for observability

---

## Test Strategy

### Unit Tests
| Component | File | Coverage |
|-----------|------|----------|
| Config Resolver | `config-resolver.test.ts` | ConfigValues mapping, env overrides, tenant scoping |
| Model Resolution | `model-resolver.test.ts` | Priority order, provider prefixes, fallbacks |
| Error Adapter | `error-adapter.test.ts` | Genkit → LLMError mapping |

### Integration Tests
| Scenario | File | Assertions |
|----------|------|------------|
| E2E model call | `genkit-integration.int.spec.ts` | Response format, timing |
| PDF conversion flow | `pdf-flow.int.spec.ts` | Extraction, verification |
| Tool calling | `tool-calling.int.spec.ts` | MCP tools, execution loop |

### Regression Tests
- All tests in `tests/int/*.int.spec.ts` must pass
- All tests in `tests/unit/*.test.ts` must pass
- Response format parity
- Performance within 20% of baseline

---

## Critical Files

### To Create
- `src/infra/llm/genkit/config-resolver.ts`
- `src/infra/llm/genkit/genkit-instance.ts`
- `src/infra/llm/genkit/plugins/gemini-plugin.ts`
- `src/infra/llm/genkit/plugins/openai-plugin.ts`
- `src/infra/llm/genkit/adapters/unified-adapter.ts`
- `src/infra/llm/genkit/flows/pdf-extraction-flow.ts`
- `src/infra/llm/genkit/flows/pdf-verification-flow.ts`

### To Modify
- `src/infra/llm/providers/factory.ts` - backward-compat shim
- `src/infra/llm/services/exercise-chat-service.ts` - migrate to Genkit
- `src/infra/llm/services/data-extractor-service.ts` - migrate to Genkit
- `src/server/payload/jobs/pdf-to-exercises-task.ts` - use flows
- `src/server/payload/endpoints/agent/chat.ts` - Genkit tool calling

### To Deprecate (Phase 5)
- `src/infra/llm/providers/gemini/*.ts`
- `src/infra/llm/providers/openai-compatible/*.ts`

### ConfigSecrets Addition
- Add `OPENAI_COMPATIBLE_BASE_URL` as a tenant-scoped secret key

---

## Dependencies

```json
{
  "dependencies": {
    "genkit": "^1.0.0",
    "@genkit-ai/googleai": "^1.0.0",
    "genkitx-openai": "^1.0.0"
  },
  "devDependencies": {
    "@genkit-ai/tools-common": "^1.0.0"
  }
}
```

---

## DevUI Setup

For local development debugging:

```bash
# Start Genkit DevUI (development only)
pnpm genkit start -- pnpm dev

# Or add to package.json scripts:
"dev:genkit": "genkit start -- pnpm dev"
```

The DevUI provides:
- Visual flow execution traces
- Input/output inspection
- Model call debugging
- Performance metrics

Only enabled when `NODE_ENV !== 'production'`.

---

## Verification

After implementation, verify:

1. **Config resolution**: Change ConfigValues → behavior changes without code changes
2. **Tenant isolation**: Different tenants can use different providers/models
3. **Backward compatibility**: `getLLMProvider()` still works during migration
4. **Job execution**: PDF conversion jobs complete successfully
5. **Tool calling**: Admin chat tools work as before
6. **Error handling**: Retries and error classification preserved
7. **Performance**: No significant degradation (< 20%)
