# Plan: Replace LLM Constants with ConfigValues

## Overview

Replace all hardcoded constants from [`src/infra/llm/providers/shared/constants.ts`](src/infra/llm/providers/shared/constants.ts) with config values from the `chat` domain in the ConfigValues collection.

## Current State

### Constants File Structure

The [`constants.ts`](src/infra/llm/providers/shared/constants.ts) file contains:

- `LLM_TIMEOUTS` - timeout values (DEFAULT, TOOL_CALL, STREAMING)
- `LLM_RETRY` - retry configuration (MAX_RETRIES, DELAY_MS, EXPONENTIAL_BASE, JITTER_FACTOR)
- `LLM_TOKENS` - token limits (DEFAULT_MAX, MAX_MAX)
- `LLM_TEMPERATURE` - temperature range (MIN, MAX, DEFAULT)
- `LLM_MULTIPART` - multipart handling (MAX_IMAGES, MAX_SIZE_MB, SUPPORTED_IMAGES, SUPPORTED_PDFS)
- `LLM_PROVIDER_URLS` - provider URLs (GEMINI_API_BASE, OPENAI_API_BASE)
- `LLM_DEFAULT_MODELS` - default models (GEMINI, OPENAI)
- `LLM_DEFAULTS` - unified defaults
- `LLM_CONSTANTS` - combined constants with new keys
- `LLMDefaults`, `LLMConstants` types

### Usages of Constants

| File                                                                              | Constants Used  | Purpose                                                              |
| --------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| [`validation.ts`](src/infra/llm/providers/shared/validation.ts)                   | `LLM_CONSTANTS` | Input validation (temperature, tokens, multipart limits, mime types) |
| [`gemini.provider.ts`](src/infra/llm/providers/gemini/gemini.provider.ts)         | `LLM_DEFAULTS`  | Default timeout and retry settings                                   |
| [`openai.provider.ts`](src/infra/llm/providers/openai/openai.provider.ts)         | `LLM_DEFAULTS`  | Default timeout and retry settings                                   |
| [`gemini-tool-calling.ts`](src/infra/llm/providers/gemini/gemini-tool-calling.ts) | `LLM_DEFAULTS`  | Default timeout and retry settings                                   |
| [`openai-tool-calling.ts`](src/infra/llm/providers/openai/openai-tool-calling.ts) | `LLM_DEFAULTS`  | Default timeout and retry settings                                   |

### Config Structure Mapping

| Current Constant                    | Config JSON Path                       | Config Key |
| ----------------------------------- | -------------------------------------- | ---------- |
| `LLM_TIMEOUTS.DEFAULT`              | `timeouts.defaultMs`                   | number     |
| `LLM_TIMEOUTS.TOOL_CALL`            | `timeouts.toolCallMs`                  | number     |
| `LLM_TIMEOUTS.STREAMING`            | `timeouts.streamingMs`                 | number     |
| `LLM_RETRY.MAX_RETRIES`             | `retry.maxRetries`                     | number     |
| `LLM_RETRY.DELAY_MS`                | `retry.delayMs`                        | number     |
| `LLM_RETRY.EXPONENTIAL_BASE`        | `retry.exponentialBase`                | number     |
| `LLM_RETRY.JITTER_FACTOR`           | `retry.jitterFactor`                   | number     |
| `LLM_TOKENS.DEFAULT_MAX`            | `tokens.defaultMax`                    | number     |
| `LLM_TOKENS.MAX_MAX`                | `tokens.maxMax`                        | number     |
| `LLM_TEMPERATURE.MIN`               | `temperature.min`                      | number     |
| `LLM_TEMPERATURE.MAX`               | `temperature.max`                      | number     |
| `LLM_TEMPERATURE.DEFAULT`           | `temperature.default`                  | number     |
| `LLM_MULTIPART.MAX_IMAGES`          | `multipart.maxImages`                  | number     |
| `LLM_MULTIPART.MAX_SIZE_MB`         | `multipart.maxSizeMb`                  | number     |
| `LLM_MULTIPART.SUPPORTED_IMAGES`    | `multipart.supportedImages`            | string[]   |
| `LLM_MULTIPART.SUPPORTED_PDFS`      | `multipart.supportedPdfs`              | string[]   |
| `LLM_PROVIDER_URLS.GEMINI_API_BASE` | `providerUrls.geminiApiBase`           | string     |
| `LLM_PROVIDER_URLS.OPENAI_API_BASE` | `providerUrls.openaiCompatibleApiBase` | string     |
| `LLM_DEFAULT_MODELS.GEMINI`         | `defaultModels.gemini`                 | string     |
| `LLM_DEFAULT_MODELS.OPENAI`         | `defaultModels.openaiCompatible`       | string     |
| `LLM_DEFAULTS.maxRetries`           | `chatSettings.defaultMaxRetries`       | number     |
| `LLM_DEFAULTS.retryDelayMs`         | `chatSettings.defaultRetryDelayMs`     | number     |
| `LLM_DEFAULTS.chatTimeoutMs`        | `chatSettings.defaultChatTimeoutMs`    | number     |
| `LLM_DEFAULTS.toolTimeoutMs`        | `chatSettings.defaultToolTimeoutMs`    | number     |
| `LLM_DEFAULTS.maxToolIterations`    | `chatSettings.maxToolIterations`       | number     |

## Implementation Steps

### Step 1: Create ChatConfig Types

**File:** [`src/infra/llm/providers/shared/chat-config.types.ts`](src/infra/llm/providers/shared/chat-config.types.ts)

Create TypeScript interfaces matching the JSON config structure:

```typescript
export interface ChatTimeoutsConfig {
  defaultMs: number
  toolCallMs: number
  streamingMs: number
}

export interface ChatRetryConfig {
  maxRetries: number
  delayMs: number
  exponentialBase: number
  jitterFactor: number
}

export interface ChatTokensConfig {
  defaultMax: number
  maxMax: number
}

export interface ChatTemperatureConfig {
  min: number
  max: number
  default: number
}

export interface ChatMultipartConfig {
  maxImages: number
  maxSizeMb: number
  supportedImages: string[]
  supportedPdfs: string[]
}

export interface ChatProviderUrlsConfig {
  geminiApiBase: string
  openaiCompatibleApiBase: string
}

export interface ChatDefaultModelsConfig {
  gemini: string
  openaiCompatible: string
}

export interface ChatSettingsConfig {
  maxToolIterations: number
  defaultMaxRetries: number
  defaultRetryDelayMs: number
  defaultChatTimeoutMs: number
  defaultToolTimeoutMs: number
}

export interface ChatConfig {
  timeouts: ChatTimeoutsConfig
  retry: ChatRetryConfig
  tokens: ChatTokensConfig
  temperature: ChatTemperatureConfig
  multipart: ChatMultipartConfig
  providerUrls: ChatProviderUrlsConfig
  defaultModels: ChatDefaultModelsConfig
  chatSettings: ChatSettingsConfig
}
```

### Step 2: Create ChatConfig Loader

**File:** [`src/infra/llm/providers/shared/chat-config.ts`](src/infra/llm/providers/shared/chat-config.ts)

Create a module to load and provide access to chat config values:

```typescript
import { ConfigDomain } from '@/infra/config/config-constants'
import { getConfigDomain, loadConfigValues, isConfigValuesLoaded } from '@/infra/config/runtime'
import type { Payload } from 'payload'
import type { ChatConfig } from './chat-config.types'

let cachedConfig: ChatConfig | null = null

export async function loadChatConfig(payload: Payload): Promise<ChatConfig> {
  if (!isConfigValuesLoaded()) {
    await loadConfigValues(payload)
  }
  return getChatConfig()
}

export function getChatConfig(): ChatConfig {
  if (!cachedConfig) {
    cachedConfig =
      getConfigDomain<ChatConfig>(ConfigDomain.Chat, { throwIfNotFound: false }) ||
      getDefaultChatConfig()
  }
  return cachedConfig
}

export function getChatConfigValue<K extends keyof ChatConfig>(key: K): ChatConfig[K] {
  const config = getChatConfig()
  return config[key]
}

export function getDefaultChatConfig(): ChatConfig {
  return {
    timeouts: { defaultMs: 30000, toolCallMs: 60000, streamingMs: 60000 },
    retry: { maxRetries: 2, delayMs: 1000, exponentialBase: 2, jitterFactor: 0.1 },
    tokens: { defaultMax: 4096, maxMax: 128000 },
    temperature: { min: 0, max: 2, default: 0.7 },
    multipart: {
      maxImages: 10,
      maxSizeMb: 20,
      supportedImages: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      supportedPdfs: ['application/pdf'],
    },
    providerUrls: {
      geminiApiBase: 'https://generativelanguage.googleapis.com/v1beta',
      openaiCompatibleApiBase: 'https://api.minimax.io/v1',
    },
    defaultModels: { gemini: 'gemini-2.0-flash-001', openaiCompatible: '' },
    chatSettings: {
      maxToolIterations: 5,
      defaultMaxRetries: 2,
      defaultRetryDelayMs: 1000,
      defaultChatTimeoutMs: 30000,
      defaultToolTimeoutMs: 60000,
    },
  }
}

export function clearChatConfigCache(): void {
  cachedConfig = null
}
```

### Step 3: Create Validation Config Accessor

**File:** [`src/infra/llm/providers/shared/validation-config.ts`](src/infra/llm/providers/shared/validation-config.ts)

Extract validation-related config for cleaner imports:

```typescript
import { getChatConfig } from './chat-config'

export function getValidationConfig() {
  const config = getChatConfig()
  return {
    minTemperature: config.temperature.min,
    maxTemperature: config.temperature.max,
    maxOutputTokens: config.tokens.maxMax,
    maxMultipartImages: config.multipart.maxImages,
    supportedImageTypes: config.multipart.supportedImages,
    supportedPdfTypes: config.multipart.supportedPdfs,
  }
}
```

### Step 4: Update validation.ts

**File:** [`src/infra/llm/providers/shared/validation.ts`](src/infra/llm/providers/shared/validation.ts)

Replace `LLM_CONSTANTS` imports with `getValidationConfig()`:

```typescript
// Before
import { LLM_CONSTANTS } from './constants'

// After
import { getValidationConfig } from './validation-config'

// Replace usage
const validationConfig = getValidationConfig()
if (
  input.model.temperature < validationConfig.minTemperature ||
  input.model.temperature > validationConfig.maxTemperature
) {
  // ...
}
```

### Step 5: Update Provider Files

Update each provider file to use config-loaded values:

**Files to Update:**

- [`src/infra/llm/providers/gemini/gemini.provider.ts`](src/infra/llm/providers/gemini/gemini.provider.ts)
- [`src/infra/llm/providers/openai/openai.provider.ts`](src/infra/llm/providers/openai/openai.provider.ts)
- [`src/infra/llm/providers/gemini/gemini-tool-calling.ts`](src/infra/llm/providers/gemini/gemini-tool-calling.ts)
- [`src/infra/llm/providers/openai/openai-tool-calling.ts`](src/infra/llm/providers/openai/openai-tool-calling.ts)

**Pattern for each file:**

```typescript
// Before
import { LLM_DEFAULTS } from '@/infra/llm/providers/shared'

// After
import { getChatConfig } from '@/infra/llm/providers/shared/chat-config'

function getChatDefaults() {
  const config = getChatConfig()
  return {
    maxRetries: config.chatSettings.defaultMaxRetries,
    retryDelayMs: config.chatSettings.defaultRetryDelayMs,
    chatTimeoutMs: config.chatSettings.defaultChatTimeoutMs,
    toolTimeoutMs: config.chatSettings.defaultToolTimeoutMs,
  }
}
```

### Step 6: Update index.ts Exports

**File:** [`src/infra/llm/providers/shared/index.ts`](src/infra/llm/providers/shared/index.ts)

Add new exports and deprecate old ones:

```typescript
export * from './constants' // Keep for backward compatibility (deprecated)
export * from './chat-config' // NEW
export * from './validation-config' // NEW
export { getChatConfig, loadChatConfig, getChatConfigValue } from './chat-config'
```

### Step 7: Mark Old Constants as Deprecated

**File:** [`src/infra/llm/providers/shared/constants.ts`](src/infra/llm/providers/shared/constants.ts)

Add deprecation JSDoc comments:

```typescript
/**
 * @deprecated Use getChatConfig() from chat-config.ts instead
 */
export const LLM_TIMEOUTS = { ... } as const
```

### Step 8: Update TypeScript Types

**File:** [`src/infra/llm/providers/shared/constants.ts`](src/infra/llm/providers/shared/constants.ts)

Add deprecated type aliases pointing to new types:

```typescript
import type { ChatConfig } from './chat-config.types'

/**
 * @deprecated Use ChatConfig from chat-config.types.ts instead
 */
export type LLMConstants = ChatConfig
```

### Step 9: Seed Initial ConfigValues Entry

**File:** [`src/server/payload/endpoints/seed/system-params.ts`](src/server/payload/endpoints/seed/system-params.ts) or create new seed script

Add a seed entry for the `chat` domain:

```typescript
const chatConfigValues = {
  domain: 'chat',
  config: {
    timeouts: { defaultMs: 30000, toolCallMs: 60000, streamingMs: 60000 },
    retry: { maxRetries: 2, delayMs: 1000, exponentialBase: 2, jitterFactor: 0.1 },
    tokens: { defaultMax: 4096, maxMax: 128000 },
    temperature: { min: 0, max: 2, default: 0.7 },
    multipart: {
      maxImages: 10,
      maxSizeMb: 20,
      supportedImages: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      supportedPdfs: ['application/pdf'],
    },
    providerUrls: {
      geminiApiBase: 'https://generativelanguage.googleapis.com/v1beta',
      openaiCompatibleApiBase: 'https://api.minimax.io/v1',
    },
    defaultModels: { gemini: 'gemini-2.0-flash-001', openaiCompatible: '' },
    chatSettings: {
      maxToolIterations: 5,
      defaultMaxRetries: 2,
      defaultRetryDelayMs: 1000,
      defaultChatTimeoutMs: 30000,
      defaultToolTimeoutMs: 60000,
    },
  },
}
```

### Step 10: Run Type Generation

```bash
pnpm generate:types
```

### Step 11: Update Tests

**Files to Update:**

- [`tests/unit/gemini-provider-multimodal.test.ts`](tests/unit/gemini-provider-multimodal.test.ts)
- Update any test files that import from constants

Add test for chat-config loader with mocking:

```typescript
vi.mock('@/infra/config/runtime', () => ({
  getConfigDomain: vi.fn(),
  isConfigValuesLoaded: vi.fn(),
}))
```

## Migration Strategy

1. **Phase 1: Create New Modules** (Steps 1-3)
   - Create types and loader without modifying existing code

2. **Phase 2: Update Provider Files** (Steps 4-6)
   - Update validation.ts and provider files to use new config
   - Keep old constants exported for backward compatibility

3. **Phase 3: Deprecation & Cleanup** (Steps 7-8)
   - Mark old constants as deprecated
   - Add type aliases

4. **Phase 4: Data Seeding** (Step 9)
   - Seed initial config values to database

5. **Phase 5: Validation** (Steps 10-11)
   - Run type generation
   - Update tests

## Rollback Plan

If issues arise, the old constants remain exported and can be re-imported by reverting the changes in provider files.

## Files to Create

| File                                                                                                         | Purpose                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| [`src/infra/llm/providers/shared/chat-config.types.ts`](src/infra/llm/providers/shared/chat-config.types.ts) | TypeScript interfaces for chat config |
| [`src/infra/llm/providers/shared/chat-config.ts`](src/infra/llm/providers/shared/chat-config.ts)             | Config loader and accessor            |
| [`src/infra/llm/providers/shared/validation-config.ts`](src/infra/llm/providers/shared/validation-config.ts) | Validation-specific config accessor   |

## Files to Modify

| File                                                                                                             | Changes                                          |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`src/infra/llm/providers/shared/validation.ts`](src/infra/llm/providers/shared/validation.ts)                   | Replace LLM_CONSTANTS with getValidationConfig() |
| [`src/infra/llm/providers/gemini/gemini.provider.ts`](src/infra/llm/providers/gemini/gemini.provider.ts)         | Replace LLM_DEFAULTS with config-loaded values   |
| [`src/infra/llm/providers/openai/openai.provider.ts`](src/infra/llm/providers/openai/openai.provider.ts)         | Replace LLM_DEFAULTS with config-loaded values   |
| [`src/infra/llm/providers/gemini/gemini-tool-calling.ts`](src/infra/llm/providers/gemini/gemini-tool-calling.ts) | Replace LLM_DEFAULTS with config-loaded values   |
| [`src/infra/llm/providers/openai/openai-tool-calling.ts`](src/infra/llm/providers/openai/openai-tool-calling.ts) | Replace LLM_DEFAULTS with config-loaded values   |
| [`src/infra/llm/providers/shared/index.ts`](src/infra/llm/providers/shared/index.ts)                             | Add new exports                                  |
| [`src/infra/llm/providers/shared/constants.ts`](src/infra/llm/providers/shared/constants.ts)                     | Add deprecation JSDoc                            |

## Seed Data Required

Create a ConfigValues entry for the `chat` domain with the default configuration values.
