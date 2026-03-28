# Architecture

## Stack

- **Framework**: Next.js 15 (App Router) + Payload CMS 3.73
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB Atlas with Vector Search
- **Testing**: Vitest (integration) + Playwright (E2E)
- **Styling**: Tailwind CSS + shadcn/ui + CSS variables
- **AI**: Google Gemini, OpenAI
- **Deployment**: Vercel

## Project Structure

```
src/
├── app/              # Next.js App Router (frontend + /admin)
├── payload/          # Payload CMS collections, globals, hooks, access control
├── server/           # Backend services, business logic
├── client/           # React hooks, state management
├── ui/               # Components (admin, web, cody)
├── infra/            # Infrastructure: auth, media, config, LLM
├── i18n/             # Internationalization (en, he)
└── types/            # TypeScript type declarations
```

## Data Flow

- **Admin**: Payload CMS → MongoDB collections (Courses, Chapters, Lessons, Exercises, Users)
- **Frontend**: Next.js routes consume Payload Local API
- **AI Features**: Chat with context, PDF→Exercises conversion via LLM
- **Vector Search**: Long-term memory via MongoDB Atlas Vector Search

## Key Patterns

- **Security**: Access control on collections via Payload hooks
- **Type Safety**: Auto-generated types from Payload schema (`pnpm generate:types`)
- **Transactions**: Pass `req` to nested operations for safety
- **Idempotency**: Source-based keys for deterministic deduplication
- **File Headers**: `@fileType`, `@domain`, `@pattern`, `@ai-summary` for AI navigation
