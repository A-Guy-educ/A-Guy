# Architecture

## Tech Stack

**Framework**: Next.js 15 (App Router) + Payload CMS 3.73  
**Language**: TypeScript (strict mode)  
**Database**: MongoDB Atlas (Vector Search enabled)  
**Testing**: Vitest (integration), Playwright (E2E)  
**Styling**: Tailwind CSS + shadcn/ui  
**Deployment**: Vercel

## Directory Structure

```
src/
├── app/                    # Next.js routes (frontend + /admin)
├── server/                 # Backend: collections, globals, hooks, endpoints, services
├── client/                 # Client-side hooks, state, utilities
├── ui/                     # React components (admin, web, cody)
├── infra/                  # Infrastructure: auth, analytics, blob, LLM, config
├── types/                  # TypeScript type declarations
├── i18n/                   # Internationalization (en.json, he.json)
└── utils/                  # Shared utilities
```

## Data Flow

1. **Content**: Payload CMS → MongoDB collections (Courses, Chapters, Lessons, Exercises)
2. **AI Features**: Google Gemini/OpenAI → PDF processing, Chat context, Embeddings
3. **Vector Search**: Content embeddings → MongoDB Atlas vector index → Long-term memory recall
4. **Auth**: OAuth (Google) → Session management → Access control
5. **AI Tooling**: SmartDocLoader, DocSearch, Pattern Index (`.ai-docs/`) enable autonomous agent navigation

## Key Services

- **Exercise Conversion**: PDF → structured exercises via Vision AI (with idempotency)
- **OAuth Handler**: Google → user creation/updates with email verification
- **Admin CMS**: Payload with custom components and type-safe configuration
- **Type Generation**: `generate:types`, `generate:importmap` required post-schema changes
- **AI Infrastructure**: `.ai-docs/` tools (SmartDocLoader, DocSearch) + scripts for doc/pattern indexing

Refer to [AGENTS.md](./AGENTS.md) for Payload-specific patterns and [CLAUDE.md](./CLAUDE.md) for development commands.
