---
name: payload-email-send-type-workaround
title: Payload Email Send Type Workaround
type: lesson
source: task:2133
recorded_at: 2026-05-28T12:06:29Z
---

Payload CMS's InitializedEmailAdapter TypeScript type does not expose a `.send()` method, causing `TS2339: Property 'send' does not exist on type 'InitializedEmailAdapter'`. Workaround: cast `payload.email as any` before calling `.send()`.
```typescript
await (payload.email as any).send({ to: userEmail, subject: '...', html })
```

**Why:** Payload's email adapter interface is typed narrowly. The runtime adapter does have a send method (or falls back to console/log adapter), but the TypeScript type doesn't reflect it. The cast is safe since we're in the email service and it's the only way to call send.

**Source task:** `2133`
