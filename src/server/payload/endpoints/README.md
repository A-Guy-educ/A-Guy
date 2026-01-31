# Payload Custom Endpoints

**Purpose**: Custom API routes beyond standard CRUD operations.

## Quick Reference (~200 tokens)

```typescript
import { APIError } from 'payload'

export const myEndpoint: Endpoint = {
  path: '/my-endpoint',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Unauthorized', 401)
    // Custom logic
    return Response.json({ success: true })
  },
}
```

---

## Available Endpoints

### Agent Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/agent/chat` | POST | AI chat interaction |
| `/agent/get-conversation` | GET | Fetch conversation |
| `/agent/reset-chat` | POST | Reset conversation |

### Exercise Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/exercises/import-from-image` | POST | Import from image |
| `/exercises/import-from-lesson` | POST | Import from lesson |

### Cron Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/cron/media-expiry` | POST | Clean expired media |

### Seed Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/seed/contact-page` | POST | Create contact page |
| `/seed/contact-form` | POST | Create contact form |

---

## Endpoint Pattern

```typescript
import type { Endpoint } from 'payload'
import { APIError } from 'payload'

export const myEndpoint: Endpoint = {
  path: '/:id/custom',
  method: 'get',
  handler: async (req) => {
    const { id } = req.routeParams
    const doc = await req.payload.findByID({
      collection: 'posts',
      id,
    })
    return Response.json(doc)
  },
}
```

---

## Related Documentation

- Collections: [`../collections/README.md`](collections/README.md)
- Services: [`../../services/`](../../services/)
