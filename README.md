# A-Guy: AI-Powered Educational Platform

A modern, AI-driven learning platform built with Payload CMS, Next.js, and MongoDB Atlas. AGuy is designed as an "AI Operating System" for education — combining a learning management system, intelligent chat with memory, content management, and multi-tenant infrastructure.

## Overview

AGuy is not a typical website or LMS. It's a unified platform that integrates:

- **Course Management**: Hierarchical content structure (Courses → Chapters → Lessons → Exercises)
- **AI-Powered Chat**: Smart tutoring with context awareness and long-term memory
- **PDF Processing**: Extract exercises from PDF documents using Vision AI
- **Multi-Tenant**: Support for multiple organizations with isolated data
- **Admin Panel**: Full-featured CMS with custom components

📖 **[Read the full introduction](./docs/a-guy/intro.md)** — Learn about A-Guy's unique approach, advantages, and technical architecture.

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| CMS & Data | Payload CMS 3.73                   |
| Frontend   | Next.js 15 (App Router)            |
| Database   | MongoDB Atlas (with Vector Search) |
| Styling    | Tailwind CSS + shadcn/ui           |
| AI         | Google Gemini, OpenAI              |
| Deployment | Vercel                             |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- MongoDB Atlas account (with Vector Search enabled)
- Google Gemini API key (for AI features)

### Setup

```bash
# Clone the repository
git clone https://github.com/A-Guy-educ/A-Guy.git
cd A-Guy

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start MongoDB (local) or ensure Atlas is configured
docker-compose up -d

# Generate types and import map
pnpm generate:types
pnpm generate:importmap

# Start development server
pnpm dev
```

Open http://localhost:3000 to access the application.

### Admin Access

The admin panel is available at `/admin`. Create your first admin user during the initial setup.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (frontend)/         # Public-facing pages
│   │   ├── courses/       # Course, chapter, lesson pages
│   │   ├── ask/           # AI chat interface
│   │   └── practice/      # Practice exercises
│   └── (payload)/         # Payload admin routes
│       └── admin/          # Admin panel
├── collections/            # Payload CMS collections
├── globals/                # Global configurations
├── hooks/                  # Custom hooks
├── ui/
│   ├── admin/             # Admin panel components
│   └── web/               # Frontend components
├── server/
│   └── payload/           # Payload server code
│       ├── collections/    # Collection configurations
│       ├── endpoints/     # Custom API endpoints
│       ├── jobs/          # Background job tasks
│       └── migrations/    # Database migrations
└── payload.config.ts      # Main Payload configuration
```

## Key Features

### Course Hierarchy

The learning content is organized in a hierarchical structure:

- **Course**: Top-level learning path
- **Chapter**: Thematic unit within a course
- **Lesson**: Individual teaching unit
- **Exercise**: Atomic learning item (questions, problems, quizzes)

### AI Chat with Memory

The platform includes an intelligent chat system that:

- Maintains conversation context across sessions
- Stores long-term memories with vector embeddings
- Provides personalized tutoring based on learning history
- Supports PDF and image uploads for analysis

### PDF to Exercise Pipeline

Convert PDF documents into structured exercises:

1. Upload PDF document
2. AI extracts content using Vision models
3. Content is chunked and stored in memory
4. Exercises are generated with context awareness

### Multi-Tenant Architecture

Built-in support for multiple organizations:

- Tenant-scoped data isolation
- Configuration entries per tenant
- Locale support for courses

## Collections

The platform includes the following Payload CMS collections:

| Collection      | Purpose                   |
| --------------- | ------------------------- |
| `users`         | User accounts with roles  |
| `courses`       | Learning courses          |
| `chapters`      | Course chapters           |
| `lessons`       | Individual lessons        |
| `exercises`     | Practice exercises        |
| `conversations` | Chat history              |
| `memoryItems`   | Long-term AI memory       |
| `media`         | File uploads              |
| `pages`         | Static pages              |
| `posts`         | Blog posts                |
| `prompts`       | AI prompt templates       |
| `tenants`       | Multi-tenant organization |

## Environment Variables

```env
# Required
DATABASE_URL=mongodb+srv://...
PAYLOAD_SECRET=your-secret-key

# AI Services
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Multi-tenant (when MCP_ENABLED=true)
DEFAULT_TENANT_SLUG=default
MCP_ENABLED=false

# Optional
MONGODB_MAX_POOL_SIZE=3
CRON_SECRET=your-cron-secret
```

## Development Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm dev:full         # Clean restart with type generation

# Database
pnpm db:start         # Start local MongoDB
pnpm db:stop          # Stop local MongoDB
pnpm db:reset         # Reset database

# Code Generation
pnpm generate:types   # Generate Payload types
pnpm generate:importmap # Generate admin import map

# Testing
pnpm test:unit        # Unit tests
pnpm test:int         # Integration tests
pnpm test:e2e         # E2E tests with Playwright
pnpm test             # All tests

# Quality
pnpm typecheck        # TypeScript check
pnpm lint             # Linting
pnpm format:check     # Format check

# Release
pnpm release          # Semantic release
```

## Documentation

Additional documentation is available in the `docs/` folder:

- [Platform Introduction](./docs/a-guy/intro.md) - Unique approach, advantages, and architecture
- [Course Hierarchy](./docs/course-hierarchy/README.md) - Content structure patterns
- [Exercises](./docs/exercises/README.md) - Exercise types and rendering
- [Exercise Import](./docs/exercise-import/README.md) - PDF to exercise flow
- [AI Services](./docs/ai-services/README.md) - AI integration details
- [Access Control](./docs/access-control/README.md) - Security patterns
- [Block Rendering](./docs/block-rendering/README.md) - Content block system
- [Chat Context](./docs/features/chat-context/README.md) - AI memory architecture

## AI Agent Support

This project includes AI-optimized documentation for autonomous agents:

- **Pattern Index**: `.ai-docs/indexes/pattern-index.json` - Code patterns by category
- **Documentation Search**: Fast keyword-based search
- **Smart Doc Loader**: Context-aware documentation loading

Generate indexes:

```bash
pnpm ai:generate-all
```

## License

MIT
