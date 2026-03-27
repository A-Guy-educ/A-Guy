# A-Guy Architecture

**Framework**: Next.js 15 (App Router) | **CMS**: Payload 3.73 | **Database**: MongoDB Atlas with Vector Search | **Language**: TypeScript | **Styling**: Tailwind CSS + shadcn/ui

## Core Structure

- **src/app** — Next.js App Router pages and layouts
- **src/server** — Payload CMS collections and hooks
- **src/infra** — Backend services (AI embeddings, vector search, PDF processing)
- **src/ui** — React components (admin panel, web, exercise renderer)
- **tests** — Vitest unit/integration tests + Playwright E2E

## Key Features

- **Hierarchical Content**: Courses → Chapters → Lessons → Exercises
- **AI Tutor**: Long-term memory via MongoDB Vector Search + Google Gemini/OpenAI
- **PDF Extraction**: Vision AI extracts exercises from documents
- **Multi-Tenant**: Isolated data per organization/user
- **Admin CMS**: Payload collections with custom layout builder blocks
- **Bilingual**: English (en) and Hebrew (he) i18n support

## Data Flow

Users interact with Next.js frontend → Next.js API routes → Payload backend → MongoDB (vectors + documents) → AI services (Gemini, OpenAI)
