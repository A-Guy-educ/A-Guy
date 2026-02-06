# Agent Bootstrap - Start Here

**Required reading before editing code**

---

## Quick Start

1. **OpenCode users**: This file and CHEAT-SHEET.md are loaded automatically via `opencode.json`
2. Other tools: Load this file (BOOTSTRAP.md)
3. Load CHEAT-SHEET.md for quick patterns
4. Load relevant READMEs for domain context

---

## Relevant Files (5-15)

Load these based on your task:

| Task Type          | Files to Load                                      |
| ------------------ | -------------------------------------------------- |
| Collection changes | CHEAT-SHEET.md, AGENTS.md (collections section)    |
| Component changes  | CHEAT-SHEET.md, DESIGN_SYSTEM.md                   |
| API endpoints      | CHEAT-SHEET.md, AGENTS.md (endpoints section)      |
| Access control     | CHEAT-SHEET.md, docs/access-control/README.md      |
| Styling            | CHEAT-SHEET.md, DESIGN_SYSTEM.md, STYLING-GUIDE.md |

---

## Source of Truth (2-3)

Always reference these authoritative docs:

1. **[AGENTS.md](../AGENTS.md)** - Core Payload CMS patterns
2. **[CHEAT-SHEET.md](./quick-reference/CHEAT-SHEET.md)** - Quick reference (~500 tokens)
3. **[DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)** - Styling system

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
