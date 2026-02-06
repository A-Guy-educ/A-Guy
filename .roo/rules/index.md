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
- **Payload-First**: Use existing URL utilities and Payload's auto-generated API endpoints (`/api/<collection-slug>`) instead of creating custom URL logic or custom CRUD routes

## Documentation by Topic

| Topic                     | Location                               |
| ------------------------- | -------------------------------------- |
| **Payload CMS (primary)** | `/AGENTS.md`                           |
| Access Control            | `docs/access-control/README.md`        |
| Admin Components          | `docs/admin-components/README.md`      |
| Testing                   | `tests/README.md`                      |
| Collections               | `src/collections/README.md`            |
| Components                | `src/components/README.md`             |
| Exercises                 | `docs/exercises/README.md`             |
| AI Services               | `docs/ai-services/README.md`           |
| i18n                      | `messages/en.json`, `messages/he.json` |
| Course Hierarchy          | `docs/course-hierarchy/README.md`      |
| Block Rendering           | `docs/block-rendering/README.md`       |

## Pattern Discovery

Find code examples using the AI-optimized indexes:

- `.ai-docs/indexes/pattern-index.json` - 208 files × 24 patterns
- `.ai-docs/readme-index.json` - 19 READMEs indexed
- `.ai-docs/indexes/doc-chunks.json` - 248 searchable chunks

## Storage Constraints

**Vercel Blob Only** - This project uses Vercel Blob storage exclusively for file storage.

See `AGENTS.md` and `.ai-docs/BOOTSTRAP.md` for AI tooling guide.
