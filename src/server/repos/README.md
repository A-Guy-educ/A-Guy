# Repository Layer

**@domain** data-access
**@fileType** repository
**@ai-summary** Database query utilities: MCP client, queries, tenant resolution

---

## Repository Registry

### Query Repositories

| Repository       | Path                            | Purpose                    |
| ---------------- | ------------------------------- | -------------------------- |
| **Courses**      | `repos/queries/courses.ts`      | Course queries + hierarchy |
| **Chapters**     | `repos/queries/chapters.ts`     | Chapter queries            |
| **Lessons**      | `repos/queries/lessons.ts`      | Lesson queries             |
| **Exercises**    | `repos/queries/exercises.ts`    | Exercise queries           |
| **UserProgress** | `repos/queries/userProgress.ts` | Progress tracking          |
| **Pages**        | `repos/queries/pages.ts`        | Page queries               |
| **Posts**        | `repos/queries/posts.ts`        | Post queries               |

### MCP Integration

| Component              | Path                                         | Purpose                 |
| ---------------------- | -------------------------------------------- | ----------------------- |
| **MCP Client**         | `repos/mcp/client/mcp-client.ts`             | MCP protocol client     |
| **Chat Integration**   | `repos/mcp/chat-integration.ts`              | MCP in chat context     |
| **Tool Allowlist**     | `repos/mcp/tool-allowlist.ts`                | MCP tool permissions    |
| **Audit Service**      | `repos/mcp/audit/audit-service.ts`           | MCP audit logging       |
| **Argument Validator** | `repos/mcp/validation/argument-validator.ts` | MCP argument validation |
| **Transforms**         | `repos/mcp/transforms/index.ts`              | Data transformations    |

### Tenant

| Component          | Path                                 | Purpose           |
| ------------------ | ------------------------------------ | ----------------- |
| **Default Tenant** | `repos/tenant/get-default-tenant.ts` | Tenant resolution |

---

## Structure

```
repos/
├── queries/
│   ├── courses.ts              # getCourseBySlug, getChaptersByCourse
│   ├── chapters.ts             # getChapterBySlug, getLessonsByChapter
│   ├── lessons.ts              # getLessonBySlug, getExercisesByLesson
│   ├── exercises.ts            # getExerciseById, searchExercises
│   ├── userProgress.ts         # getProgress, updateProgress
│   ├── pages.ts                # getPageBySlug
│   └── posts.ts                # getPosts, getPostBySlug
├── mcp/
│   ├── chat-integration.ts     # MCP in chat context
│   ├── tool-allowlist.ts       # Allowed tools config
│   ├── audit/
│   │   └── audit-service.ts    # Audit logging
│   ├── client/
│   │   ├── mcp-client.ts       # MCP protocol implementation
│   │   └── types.ts            # MCP type definitions
│   ├── transforms/
│   │   └── index.ts            # Data transforms
│   └── validation/
│       └── argument-validator.ts
└── tenant/
    └── get-default-tenant.ts   # Current tenant resolution
```

---

## Query Pattern

```typescript
// repos/queries/courses.ts
import { getPayload } from 'payload'
import config from '@payload-config'

export async function getCourseBySlug(slug: string) {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    depth: 2,
  })

  return result.docs[0] || null
}

export async function getChaptersByCourse(courseId: string) {
  const payload = await getPayload({ config })

  return payload.find({
    collection: 'chapters',
    where: { course: { equals: courseId } },
    sort: 'order',
  })
}
```

---

## MCP Client Pattern

```typescript
// repos/mcp/client/mcp-client.ts
import { createMCPAgent } from '@anthropic-ai/mcp'

export async function createMCPChat(messages: ChatMessage[]) {
  const client = await createMCPAgent({
    serverParams: {
      command: process.env.MCP_SERVER_COMMAND,
    },
  })

  const response = await client.sendMessage(messages)
  return response
}
```

---

## Agent Guardrails

### Must

- Use query repositories for all collection access (not direct Local API)
- Pass `user` with `overrideAccess: false` for user-scoped queries
- Handle `null` returns from query functions (document may not exist)
- Use `depth` parameter appropriately (0 for IDs, 2+ for relationships)

### Must Not

- Use raw `payload.find()`/`findByID()` in business logic (use repos)
- Skip access control in repositories
- Hardcode collection slugs (use constants or config)
- Return sensitive fields without field-level access checks

### Should

- Follow `getXByY` naming convention for query functions
- Use `depth: 0` when only IDs are needed (performance)
- Add JSDoc comments for query function signatures
- Cache expensive queries in `req.context` for request lifetime

---

## Related Documentation

- [`AGENTS.md`](../../../AGENTS.md) - Complete Payload patterns
- [`src/server/payload/collections/`](../payload/collections/) - Collection configurations
- [`src/server/payload/endpoints/`](../payload/endpoints/) - Custom endpoints
