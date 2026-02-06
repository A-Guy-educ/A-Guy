# OpenCode Optimization Plan

## Goal

Optimize the AI instruction layer for OpenCode compatibility while centralizing and deduplicating the existing multi-tool instruction surface.

## Current State

### Instruction Files Landscape (6 entry points, ~2,700+ lines, significant overlap)

| File                    | Lines    | Consumer              | Role                                        |
| ----------------------- | -------- | --------------------- | ------------------------------------------- |
| `AGENTS.md`             | 1,237    | All tools (canonical) | Source of truth for Payload CMS development |
| `CLAUDE.md`             | 201      | Claude Code           | Pointer + commands + skills                 |
| `INDEX.md`              | 151      | Generic agents        | Navigation map + guardrails                 |
| `.roo/rules/index.md`   | 95       | Roo Code              | Condensed summary                           |
| `.ai-docs/BOOTSTRAP.md` | 83       | All agents            | Quick-start router                          |
| `.claude/rules/`        | ~6 files | Claude Code           | Layered rule system                         |

### Problems

1. **Three conflicting "start here" paths** -- INDEX.md says BOOTSTRAP.md first, CLAUDE.md says AGENTS.md, BOOTSTRAP.md says itself then CHEAT-SHEET
2. **Content duplicated 3-4x** -- Security rules in AGENTS.md, INDEX.md, .roo/rules/index.md, CHEAT-SHEET.md; commands in CLAUDE.md, INDEX.md, .roo/rules/index.md, CHEAT-SHEET.md
3. **Stale references** -- .roo/rules/index.md points to `docs/ai/indexes/` (wrong, should be `.ai-docs/indexes/`), wrong project structure, wrong stats; CLAUDE.md references non-existent `CLAUDE_INTERNAL.md` and old import paths
4. **No OpenCode configuration** -- No `opencode.json` or `.opencode/` directory exists
5. **Token waste** -- Loading overlapping content burns context window

## Design Decisions

| Decision            | Choice                                                | Rationale                                                                                                                                 |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Instruction loading | Lean: BOOTSTRAP + CHEAT-SHEET only in `opencode.json` | All 10 READMEs would add ~5K tokens. AGENTS.md is loaded natively. The readme-index.json enables on-demand discovery.                     |
| Agent porting scope | 4 key agents                                          | payload-expert, security-auditor, code-reviewer, planner. Expand later. Lower maintenance burden.                                         |
| Deduplication       | Full slim-down of pointer files                       | Remove all duplicated content from CLAUDE.md, INDEX.md, .roo/rules/index.md. Each becomes a thin launcher with tool-specific config only. |
| Plan model          | Opus 4.6                                              | Superior reasoning for architectural decisions and implementation planning                                                                |
| Build model         | MiniMax-M2.1 (coding plan)                            | Efficient coding agent optimized for Payload CMS implementation                                                                           |

## Architecture

Hub-and-spoke model with AGENTS.md as the single source of truth:

```
AGENTS.md (hub, 1237 lines)     <- Source of truth (unchanged)
|
+-- .ai-docs/
|   +-- BOOTSTRAP.md             <- Quick-start router (minor update)
|   +-- quick-reference/
|   |   +-- CHEAT-SHEET.md       <- Token-efficient patterns (unchanged)
|   +-- indexes/                 <- Pattern + doc indexes (unchanged)
|
+-- opencode.json        (NEW)   <- OpenCode config
+-- .opencode/agents/    (NEW)   <- OpenCode-specific agents (4)
|
+-- CLAUDE.md            (UPDATE) <- Slim pointer, fix stale refs
+-- INDEX.md             (UPDATE) <- Align with BOOTSTRAP, deduplicate
+-- .roo/rules/index.md  (UPDATE) <- Fix stale paths, deduplicate
```

## Implementation Steps

### Phase 1: Create OpenCode Configuration

#### 1.1 Create `opencode.json`

**File:** `opencode.json` (project root, NEW)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [".ai-docs/BOOTSTRAP.md", ".ai-docs/quick-reference/CHEAT-SHEET.md"],
  "agent": {
    "build": {
      "model": "minimax/MiniMax-M2.1"
    },
    "plan": {
      "model": "anthropic/claude-opus-4-6"
    }
  }
}
```

> **Note:** Both model IDs should be verified by running `/models` in OpenCode after connecting providers. The Anthropic Opus 4.6 ID is based on the known pattern `anthropic/claude-opus-4-6` but may need a date suffix. The MiniMax model ID (`minimax/MiniMax-M2.1`) uses `minimax` as the provider per OpenCode docs; the model portion may differ (e.g., `M2.1`, `MiniMax-M2.1`, etc.).

**Why these instruction files:**

- `AGENTS.md` is loaded automatically by OpenCode (no need to list it)
- `BOOTSTRAP.md` provides task-routing and anti-patterns
- `CHEAT-SHEET.md` provides token-efficient patterns for 90% of tasks
- Domain READMEs are discoverable via `.ai-docs/readme-index.json` on demand

#### 1.2 Create `.opencode/agents/payload-expert.md`

**File:** `.opencode/agents/payload-expert.md` (NEW)

```markdown
---
description: Payload CMS expert for collections, hooks, access control, and API patterns
mode: subagent
tools:
  bash: false
---

You are a Payload CMS 3.x expert. When asked about Payload patterns:

1. Check `.ai-docs/indexes/pattern-index.json` for real code examples
2. Reference AGENTS.md for canonical patterns
3. Validate against `.ai-docs/schemas/collection-schema.json` for collections

Critical rules:

- Always set `overrideAccess: false` when passing `user` to Local API
- Always pass `req` to nested operations in hooks
- Use `context` flags to prevent infinite hook loops
```

#### 1.3 Create `.opencode/agents/security-auditor.md`

**File:** `.opencode/agents/security-auditor.md` (NEW)

```markdown
---
description: Security audit for access control, auth, secrets, and API endpoints
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

You are a security auditor. Review code for:

- Local API access control bypass (missing `overrideAccess: false` with `user`)
- Missing `req` in nested hook operations (transaction safety)
- Hardcoded secrets or API keys
- Missing authentication on endpoints
- Missing Zod validation on API inputs
- Field-level access control gaps

Reference: AGENTS.md security patterns section. Validate against `.ai-docs/schemas/endpoint-schema.json`.
```

#### 1.4 Create `.opencode/agents/code-reviewer.md`

**File:** `.opencode/agents/code-reviewer.md` (NEW)

```markdown
---
description: Code quality review for TypeScript, React, and Payload CMS patterns
mode: subagent
tools:
  write: false
  edit: false
---

You are a code reviewer. Focus on:

- TypeScript strict mode compliance
- `@/` import aliases (never relative imports across directories)
- Tailwind-only styling (no SCSS/CSS modules in frontend)
- Component patterns (Server Components default, Client only when needed)
- Proper use of `cn()` utility for conditional classes
- Payload conventions from AGENTS.md

Run `pnpm tsc --noEmit` and `pnpm lint` to verify.
```

#### 1.5 Create `.opencode/agents/planner.md`

**File:** `.opencode/agents/planner.md` (NEW)

```markdown
---
description: Analyze codebase and create implementation plans without making changes
mode: primary
model: anthropic/claude-opus-4-6
permission:
  edit: deny
  bash:
    '*': deny
    'git *': allow
    'pnpm tsc *': allow
    'pnpm lint*': allow
---

You are a planning agent. Analyze code and suggest implementation strategies.

Follow the 3-step plan template from `.ai-docs/BOOTSTRAP.md`:

1. Identify Pattern - Find similar code via `.ai-docs/indexes/pattern-index.json`
2. Validate Schema - Check against `.ai-docs/schemas/*.json`
3. Propose Changes - Describe what to change and why

Never modify files. Provide actionable plans with specific file paths and line numbers.
```

---

### Phase 2: Fix Stale References

#### 2.1 Fix `.roo/rules/index.md`

**Changes:**

- Line 52: `docs/ai/indexes/pattern-index.json` -> `.ai-docs/indexes/pattern-index.json`
- Line 52: `132 files x 12 patterns` -> `208 files x 24 patterns`
- Line 54: `docs/ai/indexes/doc-chunks.json` -> `.ai-docs/indexes/doc-chunks.json`
- Line 54: `217 searchable chunks` -> `248 searchable chunks`
- Lines 68-79: Fix project structure to match reality:
  - `src/collections/` -> `src/server/payload/collections/`
  - `src/access/` -> `src/server/payload/access/`
  - `src/hooks/` -> `src/server/payload/hooks/`
  - Add `src/server/` for business logic
- Line 94: `docs/ai/README.md` -> `.ai-docs/BOOTSTRAP.md`

#### 2.2 Fix `CLAUDE.md`

**Changes:**

- Lines 22-24: Remove reference to non-existent `CLAUDE_INTERNAL.md`
- Line 132: Fix import path comment `@/lib/ai/smart-doc-loader` -> note actual path is `src/infra/llm/smart-doc-loader.ts`
- Line 156: Fix import path comment `@/lib/ai/doc-search` -> note actual path is `src/infra/llm/doc-search.ts`

#### 2.3 Fix `INDEX.md`

**Changes:**

- Align reading order to match BOOTSTRAP.md (currently consistent, just verify)
- No major changes needed; INDEX.md is already well-structured

---

### Phase 3: Deduplicate Pointer Files

#### 3.1 Slim down `.roo/rules/index.md` (~95 -> ~50 lines)

**Remove:**

- Lines 56-61: Security rules summary (duplicates AGENTS.md section)
- Lines 67-79: Project structure diagram (wrong and duplicates AGENTS.md)
- Lines 81-93: AI Agent Tools section (duplicates CLAUDE.md and AGENTS.md)

**Keep:**

- Stack summary (Roo-specific context, 4 lines)
- Pointer to AGENTS.md (1 line)
- Quick commands (5 lines)
- Conventions (5 lines)
- Documentation topic table (12 lines)
- Pattern discovery with corrected paths (3 lines)
- Storage constraints note (2 lines)

#### 3.2 Slim down `CLAUDE.md` (~201 -> ~120 lines)

**Remove:**

- Lines 122-177: AI Agent Tools section (SmartDocLoader, DocSearch, Pattern Discovery code examples) -- this duplicates AGENTS.md's "AI Agent Optimization" section. Replace with a single pointer: "See AGENTS.md and `.ai-docs/BOOTSTRAP.md` for AI agent tools."

**Keep:**

- Pointer to AGENTS.md (essential)
- Quick Commands Reference (Claude-specific operational value)
- Vector Search Setup (not in AGENTS.md)
- Available Skills list (Claude Code-specific)
- Import Style rules (short, high-value)

#### 3.3 Slim down `INDEX.md` (~151 -> ~100 lines)

**Remove:**

- Lines 44-104: Pattern Index and Searchable Knowledge Assets JSON structure examples -- these duplicate what's already in BOOTSTRAP.md and the indexes themselves. Replace with a 2-line pointer.

**Keep:**

- Repository Navigation Map table (unique, high-value)
- Canonical AI Documentation table with reading order (unique)
- Guardrails section (unique framing)
- Known Non-Goals (unique)
- Quick Reference commands (4 lines)

---

### Phase 4: Update `.ai-docs/BOOTSTRAP.md` (Minor)

**Changes:**

- Add a note that OpenCode users get BOOTSTRAP.md and CHEAT-SHEET.md loaded automatically via `opencode.json`
- No structural changes needed; it's already well-designed

---

## Files Changed Summary

| Action | File                                   | Type                    | Est. Effort |
| ------ | -------------------------------------- | ----------------------- | ----------- |
| Create | `opencode.json`                        | New                     | Small       |
| Create | `.opencode/agents/payload-expert.md`   | New                     | Small       |
| Create | `.opencode/agents/security-auditor.md` | New                     | Small       |
| Create | `.opencode/agents/code-reviewer.md`    | New                     | Small       |
| Create | `.opencode/agents/planner.md`          | New                     | Small       |
| Update | `.roo/rules/index.md`                  | Fix paths + deduplicate | Medium      |
| Update | `CLAUDE.md`                            | Fix refs + deduplicate  | Medium      |
| Update | `INDEX.md`                             | Deduplicate             | Small       |
| Update | `.ai-docs/BOOTSTRAP.md`                | Minor note              | Trivial     |

**Total: 5 new files, 4 updated files**

## Model Configuration

| Mode  | Model                      |
| ----- | -------------------------- |
| Plan  | Opus 4.6                   |
| Build | MiniMax-M2.1 (coding plan) |

## Verification

After implementation, verify:

1. Run `opencode` in the project root -- confirm it loads AGENTS.md + BOOTSTRAP.md + CHEAT-SHEET.md
2. Switch to planner agent via Tab -- confirm read-only mode works
3. Type `@security-auditor` -- confirm subagent appears
4. Verify no broken references: search all `.md` files for `docs/ai/indexes/` (should be zero matches)
5. Verify `CLAUDE_INTERNAL.md` reference is gone from CLAUDE.md
6. Verify total instruction token reduction (~30% fewer duplicate tokens across pointer files)

## Risks & Mitigations

| Risk                                          | Mitigation                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| OpenCode doesn't load AGENTS.md automatically | It does -- documented in OpenCode rules docs. Falls back to CLAUDE.md if no AGENTS.md.       |
| Lean instruction set misses context           | readme-index.json enables on-demand discovery. CHEAT-SHEET.md covers 90% of tasks.           |
| Roo Code breaks after .roo/rules update       | Only fixing paths and removing duplicates. Core pointer to AGENTS.md preserved.              |
| Claude Code breaks after CLAUDE.md slim-down  | Only removing duplicated sections. All Claude-specific content (skills, commands) preserved. |
