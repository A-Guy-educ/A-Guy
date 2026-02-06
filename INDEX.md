# Code Agent Repository Snapshot

**Purpose**: Current state snapshot for code agents navigating this codebase
**Last Updated**: 2026-01-23
**Scope**: Documentation-only, static knowledge assets

---

## 1. Repository Navigation Map

| Area                 | Location                          | Purpose                                        |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| **Frontend Routes**  | `src/app/(frontend)/`             | Next.js App Router pages and components        |
| **Payload Admin**    | `src/app/(payload)/`              | Payload CMS admin panel routes                 |
| **Collections**      | `src/server/payload/collections/` | Payload CMS collection configurations          |
| **Components**       | `src/components/`                 | React components (UI, Admin, Custom)           |
| **Business Logic**   | `src/server/`                     | Server-side logic and services                 |
| **Access Control**   | `src/server/payload/access/`      | Reusable access control functions              |
| **Hooks**            | `src/server/payload/hooks/`       | Payload lifecycle hooks                        |
| **AI Documentation** | `.ai-docs/`                       | AI-optimized indexes, schemas, quick reference |
| **AI Services**      | `src/infra/llm/`                  | AI/LLM services and providers                  |

---

## 2. Canonical AI Documentation

| File                                                                                 | Purpose                                       | When to Read                |
| ------------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------- |
| [`AGENTS.md`](./AGENTS.md)                                                           | Primary Payload CMS development rules         | Deep implementation tasks   |
| [`.ai-docs/BOOTSTRAP.md`](.ai-docs/BOOTSTRAP.md)                                     | Mandatory agent bootstrap                     | Start here for any task     |
| [`.ai-docs/quick-reference/CHEAT-SHEET.md`](.ai-docs/quick-reference/CHEAT-SHEET.md) | Token-efficient quick reference (~500 tokens) | First stop for 90% of tasks |
| [`docs/access-control/README.md`](./docs/access-control/README.md)                   | Access control patterns and examples          | RBAC implementation         |
| [`docs/admin-components/README.md`](./docs/admin-components/README.md)               | Admin panel customization                     | Admin UI work               |

**Recommended Reading Order for Code Agents**

1. `.ai-docs/BOOTSTRAP.md` - Start here
2. `.ai-docs/quick-reference/CHEAT-SHEET.md`
3. `AGENTS.md`
4. Domain-specific docs (e.g. access-control, admin-components)

---

## 3. Pattern Discovery

**Pattern Index**: [`.ai-docs/indexes/pattern-index.json`](.ai-docs/indexes/pattern-index.json) - 208 files × 24 patterns

**Searchable Chunks**: [`.ai-docs/indexes/doc-chunks.json`](.ai-docs/indexes/doc-chunks.json) - 248 searchable documentation chunks

Use these indexes to find code examples and documentation by keyword or pattern.

---

## 4. Guardrails for Code Agents

### Hard Rules (Must)

- Do not edit generated index files manually
- Do not hardcode API keys or secrets - use `process.env`
- Do not pass `user` to Local API without setting `overrideAccess: false`
- Do not omit `req` in nested Payload operations within hooks
- Do not modify auth, RBAC, or core config files without architectural review

### Preferred Conventions (Should)

- Use `@/` alias for imports (e.g., `import { User } from '@/payload-types'`)
- Run `pnpm generate:types` after modifying collections
- Use the `cn()` utility for conditional classes
- Prefer Tailwind over SCSS/CSS modules in frontend components

---

## 5. Known Non-Goals

This snapshot **does not** cover:

- **Runtime AI context loading** - SmartDocLoader behavior is excluded
- **LLM prompt construction** - System prompts and prompt composers excluded
- **Token optimization logic** - DocSearch scoring and tiers excluded
- **Performance tuning** - Runtime metrics and benchmarks excluded
- **Vector search systems** - AI memory retrieval mechanisms excluded
- **Production AI flows** - In-app chat runtime behavior excluded

For these topics, refer to the source files directly or consult with project maintainers.

---

## 6. Quick Reference

```bash
# Common commands for code agents
pnpm generate:types      # Regenerate Payload types after schema changes
pnpm generate:importmap  # Regenerate admin import map
pnpm lint:fix            # Auto-fix lint issues
pnpm tsc --noEmit        # Type check
```
