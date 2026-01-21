# A-Guy Project Rules

## Stack

- Next.js 14 (App Router) + Payload CMS 3.x
- MongoDB (Atlas) + Shadcn/ui + Tailwind
- next-intl (en/he with RTL)
- pnpm (required)

## Primary Reference

**Read `/AGENTS.md`** - comprehensive Payload CMS development guide (1200+ lines).

## Quick Commands

```bash
pnpm dev              # Start development
pnpm test             # Run all tests
pnpm generate:types   # After schema changes
pnpm ci:local         # Run all quality checks
pnpm lint:fix         # Fix lint issues
```

## Conventions

- Always use `@/` for src imports (e.g., `import { User } from '@/payload-types'`)
- Use `pnpm`, never npm/yarn
- Run `pnpm generate:types` after collection changes
- Run `pnpm generate:importmap` after adding admin components

## Documentation by Topic

| Topic | Location |
|-------|----------|
| **Payload CMS (primary)** | `/AGENTS.md` |
| Access Control | `docs/access-control/README.md` |
| Admin Components | `docs/admin-components/README.md` |
| Testing | `tests/README.md` |
| Collections | `src/collections/README.md` |
| Components | `src/components/README.md` |
| Exercises | `docs/exercises/README.md` |
| AI Services | `docs/ai-services/README.md` |
| i18n | `messages/en.json`, `messages/he.json` |
| Course Hierarchy | `docs/course-hierarchy/README.md` |
| Block Rendering | `docs/block-rendering/README.md` |

## Pattern Discovery

Find code examples using the AI-optimized indexes:

- `docs/ai/indexes/pattern-index.json` - 132 files × 12 patterns
- `.ai-docs/readme-index.json` - 19 READMEs indexed
- `docs/ai/indexes/doc-chunks.json` - 217 searchable chunks

## Critical Security (from AGENTS.md)

1. **Local API bypasses access control** - use `overrideAccess: false` when passing `user`
2. **Always pass `req`** to nested operations in hooks for transaction safety
3. **Use `req.context`** flags to prevent infinite hook loops

## Project Structure

```
src/
├── app/
│   ├── (frontend)/     # Frontend routes
│   └── (payload)/      # Payload admin routes
├── collections/        # Payload collection configs
├── globals/            # Payload global configs
├── components/         # React components
├── access/             # Reusable access control functions
├── hooks/              # Reusable hook functions
└── lib/                # Business logic libraries
```

## AI Agent Tools

```typescript
// Load context-aware documentation
import { SmartDocLoader } from '@/lib/ai/smart-doc-loader'
const docs = SmartDocLoader.forCollection('create') // ~380 tokens

// Search documentation
import { getDocSearch } from '@/lib/ai/doc-search'
const search = getDocSearch()
const results = search.query('access control patterns')
```

See `docs/ai/README.md` for full AI tooling guide.
