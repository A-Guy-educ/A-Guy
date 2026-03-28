# Architecture

A-Guy is an AI-powered educational platform built on **Next.js 15** (App Router) and **Payload CMS 3.73**, with **MongoDB Atlas** + Vector Search for intelligent memory. Key components:

- **Frontend**: Next.js 15, Tailwind CSS, shadcn/ui, React
- **Backend**: Payload CMS collections, Express APIs, TypeScript
- **Database**: MongoDB Atlas with Vector Search for AI context
- **AI Features**: Google Gemini, OpenAI integration
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Multi-tenant**: Namespace isolation per organization

**Directory Structure**:

- `src/app/` — Next.js routes, API endpoints
- `src/ui/` — React components (web, admin, exercise renderer)
- `src/server/` — Payload collections, business logic
- `src/infra/` — Infrastructure (AI, media embed, vector search)
- `src/lib/` — Shared utilities

Unifies course management, AI tutoring with memory, PDF processing, and CMS.
