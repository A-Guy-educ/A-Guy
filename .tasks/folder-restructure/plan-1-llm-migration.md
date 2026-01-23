# Batch 3.5: LLM Migration Plan

**Status**: Deferred → Ready for Execution
**Source**: `src/lib/ai/`
**Target**: `src/infra/llm/`

## Naming Convention

- **Rule**: Single lowercase tokens only (e.g., `llm`, not `ai-service`)
- **No kebab-case** in any path components

## Why It Was Deferred

The LLM code has extensive interdependencies:

- **12 source files** reference LLM modules
- **69 test files** use LLM imports
- **Type re-exports** in `src/types/index.ts`
- **Tight coupling** with conversation-service, vector-search, and endpoints

## Critical Guardrails

### 1. Correct Target Path

- **Always use**: `src/infra/llm/` (NOT `src/infra/ai/`)

### 2. No Relative Imports in Migrated Code

After copying any file to `src/infra/llm/`, replace internal relative imports:

```typescript
// BAD - will break after partial migration
import { buildContextHierarchy } from '../services/conversation-service'

// GOOD - use absolute alias
import { buildContextHierarchy } from '@/infra/llm/services/conversation-service'
```

**Pre-check command after each batch:**

```bash
grep -r "from '\.\." src/infra/llm/ 2>/dev/null || echo "No relative imports found"
```

### 3. Copy Timebox (No Dual Sources of Truth)

- Copying is a **transition tactic only**
- After first import-switch batch: `src/lib/ai/` becomes legacy (no new changes)
- Once all consumers point to `@/infra/llm`, remove `src/lib/ai/` immediately

## Execution Strategy

Use a **parallel migration** approach with gradual import updates:

1. Create new `src/infra/llm/` directory structure
2. Copy files (not move) to preserve old imports during transition
3. After each file copy, fix internal relative imports
4. Use sed to batch-update consumer imports systematically
5. Run verification after each batch
6. Remove old files only after full verification

## File Inventory

### Core Modules (18 files)

```
src/lib/ai/
├── chat-message-role.ts          # Low coupling - standalone enum
├── context-policy.ts             # Medium coupling - used by endpoints
├── doc-chunk-types.ts            # Low coupling - types only
├── doc-search.ts                 # Low coupling - standalone
├── embeddings.ts                 # Medium coupling - used by vector-search
├── index.ts                      # Re-exports - update carefully
├── lesson-context.ts             # Low coupling - constants
├── maintenance.ts                # Medium coupling - used by endpoints
├── memory-extraction.ts          # High coupling - vector-search integration
├── models.ts                     # Low coupling - config types
├── observability.ts              # Low coupling - logging
├── prompt-composer.server.ts     # Medium coupling - used by endpoints
├── prompt-resolver.server.ts     # Medium coupling - used by endpoints
├── smart-doc-loader.ts           # Low coupling - standalone
├── summary.ts                    # Medium coupling - used by maintenance
├── system-prompts.server.ts      # Medium coupling - used by endpoints
├── vector-index-check.ts         # Low coupling - standalone
└── vector-search.ts              # High coupling - core component
```

### Subdirectories (2)

- `prompts/` - Prompt templates (text files, easy to move)
- `providers/gemini/` - Gemini provider implementation
- `services/` - AI services
  - `data-extractor-service.ts`
  - `exercise-chat-service.ts`
  - `image-optimizer-service.ts`

## Import Dependencies

### Source Files Using LLM (12)

1. `src/services/api/api-service.ts` → `chat-message-role`
2. `src/endpoints/agent/chat.ts` → 10 imports (highest coupling)
3. `src/endpoints/agent/get-conversation.ts` → `chat-message-role`
4. `src/endpoints/agent/reset-chat.ts` → conversation-service (already in server/services)
5. `src/endpoints/exercises/import-from-image.ts` → `data-extractor-service`
6. `src/endpoints/exercises/import-from-lesson.ts` → `data-extractor-service`
7. `src/server/payload/collections/Lessons.ts` → constant reference
8. `src/server/payload/collections/Users/roles.ts` → comment reference
9. `src/types/index.ts` → 8 type re-exports
10. `src/app/(frontend)/.../useNotebookChat.ts` → `chat-message-role`
11. `src/lib/ai/vector-search.ts` → `buildContextHierarchy` (already in server/services)
12. `src/server/services/conversation-service.ts` → already in server/services

### Test Files (69)

- 10 integration test files with extensive mocks
- 12 unit test files
- Factory files and mock utilities

## Execution Plan

### Phase 1: Create Infrastructure

```
[ ] Create src/infra/llm/ directory structure
[ ] Create src/infra/llm/prompts/
[ ] Create src/infra/llm/providers/gemini/
[ ] Create src/infra/llm/services/
[ ] Create index.ts barrel file for re-exports
```

### Phase 2: Copy Files + Fix Relative Imports

```
[ ] Copy core modules to src/infra/llm/
[ ] For each file, check and fix internal relative imports
[ ] Copy prompts/ directory
[ ] Copy providers/gemini/
[ ] Copy services/
```

### Phase 3: Update Source Imports (by dependency order)

**Batch 3.5.1: Low-coupling files (Safe to start)**

- `src/infra/llm/chat-message-role.ts`
- `src/infra/llm/doc-chunk-types.ts`
- `src/infra/llm/models.ts`
- `src/infra/llm/lesson-context.ts`
- `src/infra/llm/doc-search.ts`

**Batch 3.5.2: Type system updates**

- Update `src/types/index.ts` imports
- Update barrel file `src/infra/llm/index.ts`

**Batch 3.5.3: Medium-coupling files**

- `src/infra/llm/embeddings.ts`
- `src/infra/llm/observability.ts`
- `src/infra/llm/prompt-composer.server.ts`
- `src/infra/llm/prompt-resolver.server.ts`
- `src/infra/llm/system-prompts.server.ts`
- `src/infra/llm/summary.ts`
- `src/infra/llm/vector-index-check.ts`
- `src/infra/llm/smart-doc-loader.ts`

**Batch 3.5.4: High-coupling core files**

- `src/infra/llm/context-policy.ts`
- `src/infra/llm/maintenance.ts`
- `src/infra/llm/memory-extraction.ts`
- `src/infra/llm/vector-search.ts`

**Batch 3.5.5: Subdirectories**

- `src/infra/llm/prompts/`
- `src/infra/llm/providers/gemini/`
- `src/infra/llm/services/`

### Phase 4: Update Consumer Imports

**Batch 3.5.6: Update source file imports**

```
[ ] src/services/api/api-service.ts
[ ] src/endpoints/agent/get-conversation.ts
[ ] src/endpoints/exercises/import-from-image.ts
[ ] src/endpoints/exercises/import-from-lesson.ts
[ ] src/app/(frontend)/.../useNotebookChat.ts
[ ] src/server/payload/collections/Lessons.ts (comment only)
[ ] src/server/payload/collections/Users/roles.ts (comment only)
```

**Batch 3.5.7: Update high-coupling endpoints**

- `src/endpoints/agent/chat.ts` (10 imports - most complex)
- `src/endpoints/agent/reset-chat.ts` (already uses server/services)

**Batch 3.5.8: Update conversation-service**

- `src/server/services/conversation-service.ts` (imports from vector-search)

### Phase 5: Update Test Imports

**Batch 3.5.9: Update integration test imports**

- 10 int files with mock definitions
- Factory files

**Batch 3.5.10: Update unit test imports**

- 12 unit test files
- Mock utilities

### Phase 6: Verification & Cleanup

```
[ ] Run full verification (lint, typecheck, tests)
[ ] Update barrel exports in src/infra/llm/index.ts
[ ] Update doc comments referencing old paths
[ ] Remove old src/lib/ai/ directory
[ ] Final verification pass
```

## Import Mapping Table

| Old Import                                  | New Import                                     |
| ------------------------------------------- | ---------------------------------------------- |
| `@/lib/ai/chat-message-role`                | `@/infra/llm/chat-message-role`                |
| `@/lib/ai/context-policy`                   | `@/infra/llm/context-policy`                   |
| `@/lib/ai/doc-chunk-types`                  | `@/infra/llm/doc-chunk-types`                  |
| `@/lib/ai/doc-search`                       | `@/infra/llm/doc-search`                       |
| `@/lib/ai/embeddings`                       | `@/infra/llm/embeddings`                       |
| `@/lib/ai/index`                            | `@/infra/llm/index`                            |
| `@/lib/ai/lesson-context`                   | `@/infra/llm/lesson-context`                   |
| `@/lib/ai/maintenance`                      | `@/infra/llm/maintenance`                      |
| `@/lib/ai/memory-extraction`                | `@/infra/llm/memory-extraction`                |
| `@/lib/ai/models`                           | `@/infra/llm/models`                           |
| `@/lib/ai/observability`                    | `@/infra/llm/observability`                    |
| `@/lib/ai/prompt-composer.server`           | `@/infra/llm/prompt-composer.server`           |
| `@/lib/ai/prompt-resolver.server`           | `@/infra/llm/prompt-resolver.server`           |
| `@/lib/ai/smart-doc-loader`                 | `@/infra/llm/smart-doc-loader`                 |
| `@/lib/ai/summary`                          | `@/infra/llm/summary`                          |
| `@/lib/ai/system-prompts.server`            | `@/infra/llm/system-prompts.server`            |
| `@/lib/ai/vector-index-check`               | `@/infra/llm/vector-index-check`               |
| `@/lib/ai/vector-search`                    | `@/infra/llm/vector-search`                    |
| `@/lib/ai/services/exercise-chat-service`   | `@/infra/llm/services/exercise-chat-service`   |
| `@/lib/ai/services/data-extractor-service`  | `@/infra/llm/services/data-extractor-service`  |
| `@/lib/ai/services/image-optimizer-service` | `@/infra/llm/services/image-optimizer-service` |
| `@/lib/ai/providers/gemini`                 | `@/infra/llm/providers/gemini`                 |

## Risk Mitigation

1. **Rollback plan**: Keep old files until verification passes
2. **Batch verification**: Run verify script after each batch
3. **Type safety**: Run `tsc --noEmit` frequently
4. **Test isolation**: Don't run all tests until final phase
5. **Relative import guard**: Check for `from '../` or `from './` in `src/infra/llm/` after each copy

## Estimated Impact

- **Files to modify**: ~81 total
- **Lines of code**: ~3,500 lines
- **Risk level**: Medium (test coverage is good)
- **Estimated batches**: 10 phases

## Commands Reference

```bash
# Create directory structure
mkdir -p src/infra/llm/{prompts,providers/gemini,services}

# Copy files preserving structure
cp -r src/lib/ai/* src/infra/llm/

# Check for bad relative imports (must be empty)
grep -r "from '\.\." src/infra/llm/ 2>/dev/null || echo "✓ No relative imports found"

# Batch update imports using sed
find src/ -name "*.ts" -exec sed -i '' 's|@/lib/ai/|@/infra/llm/|g' {} \;
find tests/ -name "*.ts" -exec sed -i '' 's|@/lib/ai/|@/infra/llm/|g' {} \;

# Verify after each batch
./scripts/verify.sh

# Remove old directory (only after full verification)
rm -rf src/lib/ai/
```
