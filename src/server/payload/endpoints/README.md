# Payload CMS Custom Endpoints

**@domain** api
**@fileType** endpoint
**@ai-summary** Custom API endpoints: agent chat, cron jobs, exercise import, database seeding

---

## Endpoint Registry

| Endpoint               | Path                                        | Method   | Purpose                 | Auth          |
| ---------------------- | ------------------------------------------- | -------- | ----------------------- | ------------- |
| **Agent Chat**         | `endpoints/agent/chat/`                     | POST     | AI chat completion      | Authenticated |
| **Get Conversation**   | `endpoints/agent/get-conversation.ts`       | GET      | Retrieve chat history   | Authenticated |
| **Reset Chat**         | `endpoints/agent/reset-chat.ts`             | POST     | Clear conversation      | Authenticated |
| **Media Expiry**       | `endpoints/cron/media-expiry.ts`            | GET/POST | Cleanup expired media   | Cron/API      |
| **Import from Image**  | `endpoints/exercises/import-from-image.ts`  | POST     | Image to exercise       | Authenticated |
| **Import from Lesson** | `endpoints/exercises/import-from-lesson.ts` | POST     | Copy lesson as exercise | Authenticated |
| **Seed Contact Form**  | `endpoints/seed/contact-form.ts`            | POST     | Create contact form     | Admin         |
| **Seed Contact Page**  | `endpoints/seed/contact-page.ts`            | POST     | Create contact page     | Admin         |
| **Seed System Params** | `endpoints/seed/system-params.ts`           | POST     | Initialize config       | Admin         |
| **Run Seeding**        | `endpoints/seed/index.ts`                   | POST     | Run all seeds           | Admin         |

---

## Structure

```
endpoints/
├── agent/
│   ├── chat.ts                   # Main chat endpoint (deprecated, use chat/)
│   ├── get-conversation.ts       # GET /api/agent/conversation
│   ├── reset-chat.ts             # POST /api/agent/reset-chat
│   └── chat/                     # Modular chat implementation
│       ├── index.ts              # Main handler
│       ├── request-validation.ts # Input validation
│       ├── context-resolution.ts # Context building
│       ├── prompt-composition.ts # Prompt assembly
│       ├── memory-retrieval.ts   # Memory/search retrieval
│       └── background-tasks.ts   # Async tasks
├── cron/
│   ├── cron-middleware.ts        # Cron authentication
│   └── media-expiry.ts           # Media cleanup job
├── exercises/
│   ├── import-from-image.ts      # Image OCR → exercise
│   └── import-from-lesson.ts     # Lesson → exercise copy
└── seed/
    ├── index.ts                  # Seed orchestrator
    ├── contact-form.ts           # Contact form seed
    ├── contact-page.ts           # Contact page seed
    └── system-params.ts          # Config entries seed
```

---

## Endpoint Pattern

```typescript
// endpoints/agent/get-conversation.ts
import type { Endpoint } from 'payload'

export const getConversationEndpoint: Endpoint = {
  path: '/conversation',
  method: 'get',
  handler: async (req) => {
    if (!req.user) {
      throw new APIError('Unauthorized', 401)
    }

    const { conversationId } = req.routeParams

    const conversation = await req.payload.findByID({
      collection: 'conversations',
      id: conversationId,
      user: req.user,
      overrideAccess: false,
    })

    return Response.json(conversation)
  },
}
```

---

## Agent Chat Architecture

```
endpoints/agent/chat/
┌─────────────────────────────────────────────────────────┐
│  index.ts - Main Entry Point                            │
│  ├── Validates request (request-validation.ts)          │
│  ├── Builds context (context-resolution.ts)             │
│  ├── Composes prompt (prompt-composition.ts)            │
│  └── Returns response                                   │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────▼────────────┐
    │  Background Tasks       │
    │  (background-tasks.ts)  │
    │  ├── Memory storage     │
    │  └── Metrics recording  │
    └─────────────────────────┘
```

---

## Cron Endpoints

**File:** [`cron/cron-middleware.ts`](cron/cron-middleware.ts)

Cron endpoints require a secret token for authentication.

```typescript
// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET
const authHeader = req.headers.get('x-cron-secret')

if (authHeader !== CRON_SECRET) {
  throw new APIError('Unauthorized', 401)
}
```

---

## Agent Guardrails

### Must

- Check authentication with `req.user` before any operations
- Throw `APIError` for unauthorized access (401)
- Use `overrideAccess: false` when passing `user` to Local API
- Return `Response.json()` for all responses

### Must Not

- Skip authentication checks in endpoints
- Return raw objects without `Response.json()`
- Use `req.payload.find()` without access control
- Expose sensitive data in error responses

### Should

- Validate request body with Zod schemas before processing
- Use `req.routeParams` for path parameters
- Log errors with context using logger
- Return structured error responses `{ error: string }`

---

## Related Documentation

- [`AGENTS.md`](../../../../AGENTS.md) - Complete Payload patterns
- [`src/server/payload/services/`](../services/) - Business logic services
- [`src/app/api/`](../../../../src/app/api/) - Next.js API routes
