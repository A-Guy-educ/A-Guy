# Plan: Codebase Readability Improvement (Revised)

## Overview
**Goal:** Safe, high-ROI implementation that doesn't break paths, adds mandatory agent bootstrap, and focuses metadata where it actually improves agent performance.

---

## Severity Map

| Severity | Issue | Action |
|----------|-------|--------|
| **CRITICAL** | Missing mandatory bootstrap | Add `.ai-docs/BOOTSTRAP.md` |
| **CRITICAL** | Risky file moves without compatibility | Safe relocation + redirect map |
| **CRITICAL** | Unrealistic "100% summaries" target | Cap at 80% for P0+P1 |
| **MEDIUM** | Schemas aimed at parsing TS/TSX | Validate JSON artifacts instead |
| **MEDIUM** | Type/domain detection not in index generator | Add to `ai:generate-patterns` |
| **LOW** | Missing READMEs | Add after critical items are green |

---

## Fix 1 (CRITICAL): Add Mandatory Agent Bootstrap

### Create `.ai-docs/BOOTSTRAP.md`

```markdown
# Agent Bootstrap - Start Here

**Required reading before editing code**

---

## Quick Start

1. Load this file (BOOTSTRAP.md)
2. Load CHEAT-SHEET.md for quick patterns
3. Load relevant READMEs for domain context

---

## Relevant Files (5-15)

Load these based on your task:

| Task Type | Files to Load |
|-----------|---------------|
| Collection changes | CHEAT-SHEET.md, AGENTS.md (collections section) |
| Component changes | CHEAT-SHEET.md, DESIGN_SYSTEM.md |
| API endpoints | CHEAT-SHEET.md, AGENTS.md (endpoints section) |
| Access control | CHEAT-SHEET.md, docs/access-control/README.md |
| Styling | CHEAT-SHEET.md, DESIGN_SYSTEM.md, STYLING-GUIDE.md |

---

## Source of Truth (2-3)

Always reference these authoritative docs:

1. **[AGENTS.md](../../AGENTS.md)** - Core Payload CMS patterns
2. **[CHEAT-SHEET.md](../../.ai-docs/quick-reference/CHEAT-SHEET.md)** - Quick reference (~500 tokens)
3. **[DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)** - Styling system

---

## Plan Template (max 3 steps)

For any task:

1. **Identify Pattern** - Find similar code in `.ai-docs/indexes/pattern-index.json`
2. **Validate Schema** - Ensure changes match `.ai-docs/schemas/*.json`
3. **Generate Types** - Run `pnpm generate:types` after schema changes

---

## Checks (commands to run)

Always run these after changes:

```bash
# Type checking
pnpm tsc --noEmit

# AI docs generation
pnpm run ai:generate-patterns
pnpm run ai:generate-docs

# Validation
pnpm ts-node scripts/validate-schemas.ts

# Linting
pnpm lint
```

---

## Anti-Patterns

❌ Don't load full AGENTS.md for simple tasks (use CHEAT-SHEET.md)
❌ Don't modify collections without running `pnpm generate:types`
❌ Don't skip access control when creating collections

---

## Getting Help

- Pattern not found? Check `.ai-docs/indexes/pattern-index.json`
- Schema issues? Check `.ai-docs/schemas/`
- Still stuck? Load AGENTS.md for deep reference
```

### Acceptance Criteria
- [ ] `.ai-docs/BOOTSTRAP.md` exists
- [ ] Referenced from `CHEAT-SHEET.md`
- [ ] Referenced from `AGENTS.md`

---

## Fix 2 (CRITICAL): Safe Relocation with Backwards Compatibility

### Implementation Steps

#### Step 1: Add `.ai-docs/` structure first
```bash
mkdir -p .ai-docs/schemas
mkdir -p .ai-docs/indexes
mkdir -p .ai-docs/quick-reference
```

#### Step 2: Move files from `docs/ai/**` into `.ai-docs/**`
```bash
# Move schemas
cp -r docs/ai/schemas/* .ai-docs/schemas/

# Move indexes
cp -r docs/ai/indexes/* .ai-docs/indexes/

# Move quick-reference
cp -r docs/ai/quick-reference/* .ai-docs/quick-reference/
```

#### Step 3: Create redirect map at `docs/ai/README.md`

```markdown
# AI Documentation Redirect

⚠️ **AI-optimized files have moved to `.ai-docs/`**

This directory now serves as a redirect map.

## New Locations

| Old Path | New Path |
|----------|----------|
| `docs/ai/schemas/` | `.ai-docs/schemas/` |
| `docs/ai/indexes/` | `.ai-docs/indexes/` |
| `docs/ai/quick-reference/` | `.ai-docs/quick-reference/` |

## Quick Reference

**Always load these first:**

1. [`.ai-docs/BOOTSTRAP.md`](../../.ai-docs/BOOTSTRAP.md) - Mandatory bootstrap
2. [`.ai-docs/quick-reference/CHEAT-SHEET.md`](../../.ai-docs/quick-reference/CHEAT-SHEET.md) - Quick patterns

## Scripts Updated

The following scripts now use `.ai-docs/`:

- `pnpm run ai:generate-patterns` - Generates pattern index
- `pnpm run ai:generate-docs` - Generates doc chunks
- `pnpm run ai:generate-all` - Both generators

## Migration Complete When

- ✅ All `pnpm run ai:*` scripts pass
- ✅ No hardcoded `docs/ai/` paths in code
- ✅ `AGENTS.md` references updated
- ✅ `package.json` scripts updated
```

#### Step 4: Update references (search & replace)

**Files to check:**
- [ ] `scripts/generate-patterns.ts`
- [ ] `scripts/generate-doc-chunks.ts`
- [ ] `scripts/generate-readme-index.ts`
- [ ] `scripts/test-doc-search.ts`
- [ ] `scripts/test-smart-loader.ts`
- [ ] `package.json` scripts
- [ ] `AGENTS.md` schema references
- [ ] `docs/ai/README.md` → becomes redirect map
- [ ] Any CI workflows

**Search patterns:**
```
docs/ai/schemas/   → .ai-docs/schemas/
docs/ai/indexes/   → .ai-docs/indexes/
docs/ai/quick-reference/ → .ai-docs/quick-reference/
```

#### Step 5: Delete old directories only after verification
```bash
# Run verification
pnpm run ai:generate-patterns
pnpm run ai:generate-docs
pnpm ts-node scripts/validate-schemas.ts

# Only then delete
rm -rf docs/ai/schemas
rm -rf docs/ai/indexes
rm -rf docs/ai/quick-reference
```

### Acceptance Criteria
- [ ] `.ai-docs/` structure exists with all files
- [ ] `docs/ai/README.md` is a redirect map
- [ ] All `pnpm run ai:*` scripts pass
- [ ] No hardcoded `docs/ai/...` paths in code
- [ ] No broken links in redirect map

---

## Fix 3 (CRITICAL): Realistic Summary Coverage Target

### Change Target from 100% to 80%

**Before (unrealistic):**
```
Files with AI summaries: 24% → 100% target
```

**After (realistic):**
```
Files with AI summaries: 24% → 80% target for P0+P1 only
Explicitly exclude src/components/ui/** until later
```

### New Coverage Targets

| Priority | File Categories | Coverage Target | Count |
|----------|-----------------|-----------------|-------|
| P0 | Collections, Endpoints, Services | 100% | ~30 files |
| P1 | Components (non-UI), Admin, Blocks | 90% | ~50 files |
| P2 | UI Primitives, Providers | Skip for now | ~77 files |
| **Total** | **P0 + P1** | **80%** | **~80 files** |

### Updated Success Metrics

| Metric | Current | P0+P1 Target |
|--------|---------|--------------|
| Files with AI summaries | 24% | 80% |
| Files with type | 19% | 80% |
| Files with domain | 24% | 80% |
| Schema coverage | 1/4 | 4/4 |
| Overall score | 91/100 | 95/100 |

### Acceptance Criteria
- [ ] Plan reflects 80% target for P0+P1
- [ ] `src/components/ui/**` explicitly excluded from Phase 1
- [ ] Summary coverage report distinguishes P0/P1 vs UI primitives

---

## Fix 4 (MEDIUM): Schemas Validate JSON Artifacts, Not TS/TSX

### Problem
Current plan implies parsing TS/TSX into JSON then validating with schema - this is brittle and will rot.

### Solution
Schemas should validate **generated metadata artifacts** only:

- `.ai-docs/indexes/pattern-index.json`
- `.ai-docs/indexes/doc-chunks.json`
- `.ai-docs/indexes/readme-index.json`

### Updated Component Schema (`.ai-docs/schemas/component-schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Component Metadata Entry",
  "type": "object",
  "required": ["path", "type", "domain", "patterns"],
  "properties": {
    "path": {
      "type": "string",
      "pattern": "^src/components/"
    },
    "type": {
      "enum": ["ui-component", "admin-component", "block-component", "provider", "client-component", "server-component"]
    },
    "domain": {
      "enum": ["general", "auth", "chat", "education", "exercises", "analytics", "media"]
    },
    "patterns": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "aiSummary": {
      "type": "string",
      "maxLength": 200
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### Updated Endpoint Schema (`.ai-docs/schemas/endpoint-schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Endpoint Metadata Entry",
  "type": "object",
  "required": ["path", "type", "domain", "patterns"],
  "properties": {
    "path": {
      "type": "string",
      "pattern": "^src/"
    },
    "type": {
      "enum": ["endpoint", "api-route", "service"]
    },
    "domain": {
      "enum": ["chat", "auth", "general", "ai"]
    },
    "patterns": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "aiSummary": {
      "type": "string",
      "maxLength": 200
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### Updated Validation Script (`.ai-docs/validate-schemas.ts`)

```typescript
#!/usr/bin/env ts-node

import Ajv from 'ajv'
import fs from 'fs'
import path from 'path'

interface ValidationResult {
  file: string
  valid: boolean
  errors?: string[]
}

async function main() {
  const patternIndex = JSON.parse(fs.readFileSync('.ai-docs/indexes/pattern-index.json', 'utf-8'))
  const collectionSchema = JSON.parse(fs.readFileSync('.ai-docs/schemas/collection-schema.json', 'utf-8'))
  const componentSchema = JSON.parse(fs.readFileSync('.ai-docs/schemas/component-schema.json', 'utf-8'))
  const endpointSchema = JSON.parse(fs.readFileSync('.ai-docs/schemas/endpoint-schema.json', 'utf-8'))

  const ajv = new Ajv()
  const validateComponent = ajv.compile(componentSchema)
  const validateEndpoint = ajv.compile(endpointSchema)

  const results: ValidationResult[] = []

  // Validate pattern-index.json entries
  Object.entries(patternIndex.fileMetadata || {}).forEach(([path, metadata]: [string, any]) => {
    if (path.includes('/components/')) {
      const valid = validateComponent(metadata)
      results.push({ file: path, valid: !!valid, errors: validateComponent.errors?.map(e => e.message) })
    }
    if (path.includes('/endpoints/') || path.includes('/app/api/')) {
      const valid = validateEndpoint(metadata)
      results.push({ file: path, valid: !!valid, errors: validateEndpoint.errors?.map(e => e.message) })
    }
  })

  const passed = results.filter(r => r.valid).length
  const failed = results.filter(r => !r.valid).length

  console.log(`Schema Validation: ${passed}/${results.length} passed`)

  if (failed > 0) {
    console.log('Failed entries:')
    results.filter(r => !r.valid).forEach(r => {
      console.log(`  - ${r.file}: ${r.errors?.join(', ')}`)
    })
    process.exit(1)
  }
}

main()
```

### Acceptance Criteria
- [ ] Schemas describe metadata entries, not code AST
- [ ] `validate-schemas.ts` validates JSON artifacts
- [ ] Script fails on malformed metadata entries

---

## Fix 5 (MEDIUM): Type/Domain Auto-Detect in Index Generator

### Implementation

Add `detectType()` and `detectDomain()` to the existing pattern generator script (`scripts/generate-patterns.ts`).

### Detection Logic

```typescript
// Add to scripts/generate-patterns.ts

function detectType(filePath: string): string {
  const ext = path.extname(filePath)

  if (ext === '.ts') {
    if (filePath.includes('/collections/')) return 'collection-config'
    if (filePath.includes('/endpoints/')) return 'endpoint'
    if (filePath.includes('/lib/services/')) return 'service'
    if (filePath.includes('/lib/ai/')) return 'ai-utility'
    if (filePath.includes('/types/')) return 'type-exports'
    if (filePath.includes('/fields/')) return 'field-config'
    if (filePath.includes('/hooks/')) return 'hook'
    if (filePath.includes('/plugins/')) return 'plugin'
  }

  if (ext === '.tsx') {
    if (filePath.includes('/components/ui/')) return 'ui-component'
    if (filePath.includes('/components/admin/')) return 'admin-component'
    if (filePath.includes('/blocks/')) return 'block-component'
    if (filePath.includes('/providers/')) return 'provider'
  }

  return 'unknown'
}

function detectDomain(filePath: string): string {
  if (filePath.includes('courses') || filePath.includes('chapters') || filePath.includes('lessons')) {
    return 'education'
  }
  if (filePath.includes('exercise')) return 'exercises'
  if (filePath.includes('chat') || filePath.includes('conversation') || filePath.includes('memory')) {
    return 'chat'
  }
  if (filePath.includes('auth') || filePath.includes('oauth') || filePath.includes('users')) {
    return 'auth'
  }
  if (filePath.includes('analytics')) return 'analytics'
  if (filePath.includes('media') || filePath.includes('pdf')) return 'media'
  return 'general'
}

// Integrate into existing generation logic
function generateMetadata(filePath: string, content: string) {
  return {
    path: filePath,
    type: detectType(filePath),
    domain: detectDomain(filePath),
    patterns: detectPatterns(content, filePath),
    aiSummary: generateSummary(content, filePath),
    dependencies: detectDependencies(content)
  }
}
```

### Target Folders for Improvement

| Folder | Current "unknown/general" | Target |
|--------|---------------------------|--------|
| `src/collections/**` | High | <10% |
| `src/app/api/**` | High | <10% |
| `src/endpoints/**` | High | <10% |
| `src/lib/**` | High | <10% |

### Acceptance Criteria
- [ ] `detectType()` and `detectDomain()` added to index generator
- [ ] Report shows meaningful improvement for target folders
- [ ] P0+P1 files have meaningful type/domain values

---

## Fix 6 (LOW): Add Missing READMEs (After Above Is Green)

### Create Only After Critical Items Pass

- [ ] `src/collections/README.md`
- [ ] `src/access/README.md`
- [ ] `src/hooks/README.md`

### Template for Each

```markdown
# [Name]

**@domain** [domain]
**@fileType** documentation

---

## Overview

Brief description.

## Key Files

| File | Description |
|------|-------------|
| `file.ts` | Description |

## Patterns Used

- Pattern1
- Pattern2

## See Also

- [AGENTS.md](../../AGENTS.md) - Full patterns
- [.ai-docs/quick-reference/CHEAT-SHEET.md](../../.ai-docs/quick-reference/CHEAT-SHEET.md) - Quick reference
```

---

## Implementation Schedule

| Phase | Duration | Tasks | Blocking |
|-------|----------|-------|----------|
| Fix 1 | Day 1 | Create BOOTSTRAP.md | - |
| Fix 2 | Day 1-2 | Safe relocation + redirect map | Fix 1 |
| Fix 4 | Day 3 | Update schemas for JSON validation | Fix 2 |
| Fix 5 | Day 3 | Add type/domain detection | Fix 2 |
| Fix 3 | Day 4 | Update coverage targets | - |
| Fix 6 | Day 5 | Add missing READMEs | All above |

---

## Deliverables Checklist (PR Must Include)

- [ ] `.ai-docs/BOOTSTRAP.md` exists
- [ ] `.ai-docs/` structure with moved files
- [ ] `docs/ai/README.md` redirect map
- [ ] Updated paths in scripts/docs/package.json
- [ ] Updated plan targets (80% for P0+P1, no 100%)
- [ ] Updated schemas validate JSON artifacts
- [ ] Type/domain detection in index generator
- [ ] All `ai:*` scripts pass
- [ ] `pnpm ts-node scripts/validate-schemas.ts` passes
- [ ] Missing READMEs (optional, after green)

---

## Guardrails

1. **No deletions** of old `docs/ai/**` folders until scripts are green
2. **All moved files** must have references updated in the same PR
3. **If anything breaks**: rollback the move, keep BOOTSTRAP
4. **No 100% coverage target** unless justified

---

## Definition of Done

- [ ] Agent can find bootstrap + cheat sheet in <30s
- [ ] AI docs paths are consistent and single-rooted under `.ai-docs/`
- [ ] Index generation and schema validation run green
- [ ] Plan updated to realistic, high-ROI targets
- [ ] P0+P1 files have meaningful metadata (type/domain/summary)
