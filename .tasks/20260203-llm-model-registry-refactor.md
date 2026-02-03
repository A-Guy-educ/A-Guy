# LLM Model Registry Refactoring Plan

## Overview

Refactor `src/infra/llm/models.ts` to be the single source of truth for all model definitions, eliminating duplication with `factory.ts` and enabling proper provider switching.

## Problems Solved

1. **Dual Definition**: Model names are currently defined in both `models.ts` and `factory.ts`'s `PROVIDER_MODEL_MAP`
2. **Inconsistent Usage**: Services like `data-extractor-service.ts` bypass the factory and import `AI_MODELS` directly
3. **No Runtime Overrides**: Cannot override model selection at runtime via config
4. **Type Duplication**: `AIModel` type defined separately in multiple providers

## Implementation Steps

### Step 1: Refactor `models.ts` - Centralized Model Registry

**New Structure:**

```typescript
// src/infra/llm/models.ts

import type { LLMProviderType } from './providers/factory'

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types (consolidated from providers)
// ─────────────────────────────────────────────────────────────────────────────

export interface AIModel {
  name: string // Provider-specific model name
  temperature: number // Generation temperature
  maxOutputTokens: number // Max output tokens
  capabilities?: string[] // e.g., ['multimodal', 'vision', 'tools']
}

export type AIModelKey = 'IMAGE_TO_EXERCISE' | 'EXERCISE_CHAT' | 'PDF_TO_EXERCISE'

// ─────────────────────────────────────────────────────────────────────────────
// Model Registry - Single Source of Truth
// ─────────────────────────────────────────────────────────────────────────────

// Provider-agnostic model configurations (temperature, maxTokens, capabilities)
export const MODEL_REGISTRY: Record<AIModelKey, Omit<AIModel, 'name'>> = {
  IMAGE_TO_EXERCISE: {
    temperature: 0.2,
    maxOutputTokens: 8192,
    capabilities: ['multimodal', 'vision'],
  },
  EXERCISE_CHAT: {
    temperature: 0.7,
    maxOutputTokens: 2048,
    capabilities: ['multimodal', 'chat'],
  },
  PDF_TO_EXERCISE: {
    temperature: 0.1,
    maxOutputTokens: 8192,
    capabilities: ['document', 'extraction'],
  },
} as const

// Provider-specific model name mappings (moved from factory.ts)
export const PROVIDER_MODEL_NAMES: Record<LLMProviderType, Record<AIModelKey, string>> = {
  [LLMProviderType.GEMINI]: {
    IMAGE_TO_EXERCISE: 'gemini-2.0-flash-001',
    EXERCISE_CHAT: 'gemini-2.0-flash-001',
    PDF_TO_EXERCISE: 'gemini-2.0-flash-001',
  },
  [LLMProviderType.OPENAI_COMPATIBLE]: {
    IMAGE_TO_EXERCISE: 'MiniMax-M2.1',
    EXERCISE_CHAT: 'MiniMax-M2.1',
    PDF_TO_EXERCISE: 'MiniMax-M2.1',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Exports (backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export const AI_MODELS: Record<AIModelKey, AIModel> = {
  IMAGE_TO_EXERCISE: {
    ...MODEL_REGISTRY.IMAGE_TO_EXERCISE,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].IMAGE_TO_EXERCISE,
  },
  EXERCISE_CHAT: {
    ...MODEL_REGISTRY.EXERCISE_CHAT,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].EXERCISE_CHAT,
  },
  PDF_TO_EXERCISE: {
    ...MODEL_REGISTRY.PDF_TO_EXERCISE,
    name: PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI].PDF_TO_EXERCISE,
  },
}

export type { AIModel }
```

### Step 2: Update `factory.ts` - Use Model Registry

**Changes:**

- Remove `PROVIDER_MODEL_MAP` (moved to `models.ts`)
- Import from `MODEL_REGISTRY` and `PROVIDER_MODEL_NAMES`
- Add runtime override support

```typescript
// New imports in factory.ts
import { MODEL_REGISTRY, PROVIDER_MODEL_NAMES, type AIModelKey, type AIModel } from '../models'

// Add runtime override function
export function getModelOverride(modelKey: AIModelKey): string | undefined {
  const envVar = `LLM_MODEL_OVERRIDE_${modelKey}`
  return process.env[envVar] || process.env.LLM_MODEL_OVERRIDE_DEFAULT
}

// Update getProviderModelConfig to use registry
export function getProviderModelConfig(
  providerType: LLMProviderType,
  modelKey: AIModelKey = DEFAULT_MODEL_KEY,
): AIModel {
  // Check for runtime override first
  const override = getModelOverride(modelKey)
  if (override) {
    return {
      name: override,
      ...MODEL_REGISTRY[modelKey],
    }
  }

  return {
    name: PROVIDER_MODEL_NAMES[providerType][modelKey],
    ...MODEL_REGISTRY[modelKey],
  }
}
```

### Step 3: Consolidate `AIModel` Type

**In `providers/gemini/index.ts`:**

```typescript
// Remove local AIModel definition
export type { AIModel } from '../../models'
export type { AIModelKey } from '../../models'
```

**In `providers/openai/index.ts`:**

```typescript
export type { AIModel, AIModelKey } from '../../models'
```

### Step 4: Update Services - Use Factory

**In `data-extractor-service.ts`:**

```typescript
// Before (bypasses factory)
import { AI_MODELS } from '../models'
const modelConfig = AI_MODELS.IMAGE_TO_EXERCISE

// After (uses factory for provider switching)
import { getLLMProvider, getProviderModelConfig } from '../providers/factory'
const provider = await getLLMProvider(payload)
const modelConfig = getProviderModelConfig(providerType, 'IMAGE_TO_EXERCISE')
```

**In `exercise-chat-service.ts`:**

```typescript
// Similar pattern - use factory for provider-agnostic model selection
```

### Step 5: Add Tests

**New test file: `tests/unit/infra/llm/models.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { MODEL_REGISTRY, PROVIDER_MODEL_NAMES, AI_MODELS } from '@/infra/llm/models'
import { LLMProviderType } from '@/infra/llm/providers/factory'

describe('models.ts', () => {
  describe('MODEL_REGISTRY', () => {
    it('should have consistent structure for all models', () => {
      const keys = Object.keys(MODEL_REGISTRY) as AIModelKey[]

      for (const key of keys) {
        const model = MODEL_REGISTRY[key]
        expect(model.temperature).toBeDefined()
        expect(model.maxOutputTokens).toBeDefined()
        expect(typeof model.temperature).toBe('number')
        expect(typeof model.maxOutputTokens).toBe('number')
      }
    })

    it('should have temperature within valid range', () => {
      const keys = Object.keys(MODEL_REGISTRY) as AIModelKey[]

      for (const key of keys) {
        const model = MODEL_REGISTRY[key]
        expect(model.temperature).toBeGreaterThanOrEqual(0)
        expect(model.temperature).toBeLessThanOrEqual(2)
      }
    })
  })

  describe('PROVIDER_MODEL_NAMES', () => {
    it('should have provider mapping for all providers', () => {
      const providers = Object.values(LLMProviderType)
      const modelKeys = Object.keys(PROVIDER_MODEL_NAMES[providers[0]]) as AIModelKey[]

      for (const provider of providers) {
        for (const modelKey of modelKeys) {
          expect(PROVIDER_MODEL_NAMES[provider][modelKey]).toBeDefined()
          expect(typeof PROVIDER_MODEL_NAMES[provider][modelKey]).toBe('string')
        }
      }
    })
  })

  describe('AI_MODELS (backward compatibility)', () => {
    it('should match MODEL_REGISTRY for gemini provider', () => {
      const keys = Object.keys(AI_MODELS) as AIModelKey[]

      for (const key of keys) {
        const geminiName = PROVIDER_MODEL_NAMES[LLMProviderType.GEMINI][key]
        expect(AI_MODELS[key].name).toBe(geminiName)
        expect(AI_MODELS[key].temperature).toBe(MODEL_REGISTRY[key].temperature)
        expect(AI_MODELS[key].maxOutputTokens).toBe(MODEL_REGISTRY[key].maxOutputTokens)
      }
    })
  })
})
```

**Update `tests/unit/infra/llm/providers/factory.test.ts`:**

```typescript
describe('factory.ts - getProviderModelConfig', () => {
  it('should return gemini model config by default', () => {
    const config = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
    expect(config.name).toBe('gemini-2.0-flash-001')
    expect(config.temperature).toBe(MODEL_REGISTRY.EXERCISE_CHAT.temperature)
  })

  it('should return openai-compatible model config when specified', () => {
    const config = getProviderModelConfig(LLMProviderType.OPENAI_COMPATIBLE, 'EXERCISE_CHAT')
    expect(config.name).toBe('MiniMax-M2.1')
    expect(config.temperature).toBe(MODEL_REGISTRY.EXERCISE_CHAT.temperature)
  })
})
```

### Step 6: Update Exports

**In `infra/llm/index.ts`:**

```typescript
// Add new exports
export { MODEL_REGISTRY, PROVIDER_MODEL_NAMES } from './models'
```

## Files Modified

| File                                               | Change                                       |
| -------------------------------------------------- | -------------------------------------------- |
| `src/infra/llm/models.ts`                          | Complete rewrite with model registry pattern |
| `src/infra/llm/providers/factory.ts`               | Import from registry, add override support   |
| `src/infra/llm/providers/gemini/index.ts`          | Re-export AIModel from models.ts             |
| `src/infra/llm/providers/openai/index.ts`          | Re-export AIModel from models.ts             |
| `src/infra/llm/services/data-extractor-service.ts` | Use factory for model selection              |
| `src/infra/llm/services/exercise-chat-service.ts`  | Use factory for model selection              |
| `src/infra/llm/index.ts`                           | Update exports                               |
| `tests/unit/infra/llm/models.test.ts`              | New test file                                |
| `tests/unit/infra/llm/providers/factory.test.ts`   | Add factory tests                            |

## Backward Compatibility

- `AI_MODELS` export remains unchanged for existing consumers
- `AIModelKey` and `AIModelConfig` types preserved
- All existing imports continue to work

## Environment Variables for Overrides

```bash
# Override specific model
LLM_MODEL_OVERRIDE_EXERCISE_CHAT=gemini-1.5-pro

# Default override for all models
LLM_MODEL_OVERRIDE_DEFAULT=gpt-4o
```
