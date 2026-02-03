## Summary

This PR refactors the LLM model registry to be the single source of truth for all model definitions, enabling proper provider switching at runtime between Gemini and OpenAI-compatible providers.

## Problem

- `models.ts` and `factory.ts` had duplicated model definitions
- No proper runtime model switching support
- Circular dependency between modules
- Types were duplicated across providers

## Solution

### New Architecture

1. **Centralized Model Registry** (`src/infra/llm/models.ts`)
   - `MODEL_REGISTRY`: Provider-agnostic configs (temperature, maxOutputTokens, capabilities)
   - `PROVIDER_MODEL_NAMES`: Provider-specific model name mappings
   - `AI_MODELS`: Backward-compatible convenience export

2. **Provider Types** (`src/infra/llm/providers/types.ts`)
   - New file to break circular dependency
   - Contains `LLMProviderType` enum

3. **Factory Refactored** (`src/infra/llm/providers/factory.ts`)
   - Now imports from centralized models.ts
   - Exports `LLMProviderType` for backward compatibility

### Key Features

- **Runtime Model Overrides**: Set `LLM_MODEL_OVERRIDE_<MODEL_KEY>` or `LLM_MODEL_OVERRIDE_DEFAULT` env vars
- **Provider Switching**: Seamless switching between Gemini and OpenAI-compatible via `LLM_PROVIDER` env var
- **Single Source of Truth**: All model definitions in one place
- **Type Safety**: Consolidated `AIModel` type definition

## Files Changed

### New Files
- `src/infra/llm/providers/types.ts` - Provider type definitions

### Modified Files
- `src/infra/llm/models.ts` - Centralized model registry
- `src/infra/llm/providers/factory.ts` - Refactored to use registry
- `src/infra/llm/providers/gemini/index.ts` - Updated exports
- `src/infra/llm/providers/openai/index.ts` - Updated exports
- `src/infra/llm/index.ts` - Updated exports

### Test Files
- `tests/unit/infra/llm/models.test.ts` - New (23 tests)
- `tests/unit/infra/llm/providers/factory.test.ts` - Extended (20 tests)

## Usage Examples

### Get model config for specific provider
```typescript
import { getProviderModelConfig } from '@/infra/llm/models'
import { LLMProviderType } from '@/infra/llm/providers/factory'

const config = getProviderModelConfig(LLMProviderType.GEMINI, 'EXERCISE_CHAT')
// Returns: { name: 'gemini-2.0-flash-001', temperature: 0.7, maxOutputTokens: 2048, capabilities: ['multimodal', 'chat'] }
```

### Runtime model override
```bash
# Override specific model
export LLM_MODEL_OVERRIDE_EXERCISE_CHAT=gemini-1.5-pro

# Or set default override
export LLM_MODEL_OVERRIDE_DEFAULT=gpt-4o
```

## Testing

All 968 tests passed (5 skipped):
- `tests/unit/infra/llm/models.test.ts`: 23 tests
- `tests/unit/infra/llm/providers/factory.test.ts`: 20 tests

## Checklist

- [x] Code follows project conventions
- [x] Self-reviewed changes
- [x] Lint passes (no new warnings)
- [x] Tests pass (968 passed, 5 skipped)
- [x] Documentation in code comments updated

---

**PR URL**: https://github.com/A-Guy-educ/A-Guy/pull/new/refactor/llm-model-registry
**Base Branch**: dev
**Compare Branch**: refactor/llm-model-registry
