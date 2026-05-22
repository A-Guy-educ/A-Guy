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

1. **Content**: Payload CMS → MongoDB collections (Courses, Lessons, Exercises)
2. **AI Features**: Google Gemini/OpenAI → PDF processing, Chat context
3. **Auth**: OAuth (Google) → Session management → Access control
4. **Vector Search**: Content embeddings → MongoDB Atlas vector index → Memory recall

## Key Services

- **Exercise Conversion**: PDF → structured exercises (with idempotency)
- **OAuth Handler**: Google → user creation/updates
- **Admin CMS**: Payload admin UI with custom components
- **Type Generation**: `generate:types`, `generate:importmap` post-schema changes
- **AI Documentation Pipeline**: Automated generation of doc chunks, pattern indexes, and route maps for AI context (scripts: `ai:generate-docs`, `ai:generate-patterns`, `ai:generate-all-indexes`)

Refer to [AGENTS.md](./AGENTS.md) for Payload-specific patterns and [CLAUDE.md](./CLAUDE.md) for development commands.

## Content Security Policy (#1604)

CSP headers are defined in `next.config.js` per route. The Vercel feedback script (`https://vercel.live/_next-live/feedback/feedback.js`) requires `https://vercel.live` in both `script-src` and `connect-src` directives for `/admin/:path*` routes. Without this, the "Give feedback" button on the admin panel is blocked.

## Lesson Duplication: Cron Trigger (#1602)

Non-trivial duplication (light/medium/deep) is triggered by a Vercel cron worker at `/api/cron/process-duplications` (runs every minute). The `lesson-duplications` collection is the queue; the cron endpoint claims one record per tick and delegates to the resumable orchestrator. See [lesson-duplication.md](./lesson-duplication.md) for details.
