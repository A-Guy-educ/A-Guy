# Task 2228: Exhaustive ARCHITECTURE.md

## What was done

Produced `docs/ARCHITECTURE.md` (1038 lines) — an exhaustive reference covering:

1. **System Overview** — two-layer architecture (Next.js frontend + Payload CMS backend), key domain invariants
2. **Directory Structure** — full tree of all `src/` subdirectories with one-line descriptions
3. **Request / Data Flow** — 6 annotated flows: unauthenticated page, authenticated learning, AI chat, checkout, PDF→exercise conversion job, exercise rendering
4. **Module Breakdown** — 9 sections covering every `src/` subdirectory:
   - `src/app` (App Router) — all frontend routes + API routes (60+ endpoints catalogued)
   - `src/server/payload` — all 30 collections, 9 blocks, 9 access functions, hooks, jobs, endpoints, migrations, plugins
   - `src/server/services` — 14 services catalogued
   - `src/server/repos` — 12 query helpers, MCP client, tenant resolution
   - `src/infra` — LLM, auth, analytics, contracts, media, PDF
   - `src/lib` — payment providers (Stripe/PayPal), LaTeX parser, products
   - `src/client` — hooks, providers, localStorage state
   - `src/ui` — 30+ admin components, 9 exercise block renderers, chat UI, header/footer, media renderers
   - `src/i18n`, `src/brands`, `src/utils`
5. **Mermaid Module-Dependency Diagram** — text-based diagram showing all layer relationships
6. **Top 10 Refactor Opportunities** — with file:line references:
   1. `conversation-service.ts` double `as unknown as` casts (line ~122)
   2. `logActivity.ts` stringly-typed `actionType` parameter
   3. `helpers.ts` plain-object error throws instead of Error subclasses
   4. V2 job handler is a 130-line god function (9 pipeline stages)
   5. `runner/route.ts` uses `console.error` instead of pino logger
   6. `Conversations` messages field stores untyped JSON
   7. `Courses.accessType` is stringly typed (not a union)
   8. `rate-limit.ts` in-memory Map fails in serverless
   9. `UserProgress` missing unique (user, lesson) compound index
   10. N+1 queries in `getCourseIdFromContext` (up to 4 sequential DB calls)

## Verification

- `docs/ARCHITECTURE.md` created (1038 lines)
- Every `src/` subdirectory referenced in Table of Contents
- Mermaid diagram included
- 10 refactor opportunities with exact file:line references

## Notes for next engineer

- The architecture is large but follows clear patterns: Next.js App Router → Payload Local API → MongoDB
- The AI chat system is the most complex subsystem (context-scoped conversations, hierarchical memory, MCP tools for admins, guest sessions)
- The PDF→exercise V2 pipeline is the most operationally critical (handles 9 passes, uses atomic job claiming)
- No code was modified — this was a documentation-only task
