# Application Routes

**@domain** app
**@fileType** routes
**@ai-summary** Next.js App Router: frontend pages, Payload admin, API routes

---

## Structure

```
app/
├── (frontend)/              # Frontend routes (public + authenticated)
│   ├── [slug]/             # Dynamic page routes
│   ├── account/            # User account
│   ├── courses/            # Course pages
│   ├── exercises/          # Exercise pages
│   ├── login/              # Login page
│   ├── posts/              # Blog posts
│   ├── practice/           # Practice page
│   ├── search/             # Search page
│   ├── signup/             # Signup page
│   ├── study/              # Study page
│   ├── test/               # Test page
│   └── page.tsx            # Homepage
├── (payload)/              # Payload CMS routes
│   ├── admin/              # Admin panel
│   └── api/                # API routes (GraphQL, REST)
└── api/                    # Custom API routes
    ├── agent/              # AI agent endpoints
    ├── exercises/          # Exercise endpoints
    ├── oauth/google/       # OAuth endpoints
    └── pdfjs-viewer/       # PDF viewer
```

## Patterns

| Pattern       | Location                          | Description           |
| ------------- | --------------------------------- | --------------------- |
| page-server   | `(frontend)/path/`                | Server component page |
| page-client   | `(frontend)/path/page.client.tsx` | Client component page |
| route-dynamic | `(frontend)/[slug]/`              | Dynamic route segment |
| payload-api   | `(payload)/api/`                  | Payload API routes    |

## Key Files

- [`(frontend)/page.tsx`(../app/(frontend)/page.tsx>) - Homepage
- [`(frontend)/courses/page.tsx`(../app/(frontend)/courses/page.tsx>) - Courses listing
- [`(payload)/admin/`(../app/(payload)/admin/>) - Payload admin panel
- [`api/agent/conversation/route.ts`](./api/agent/conversation/route.ts) - AI chat endpoint

## Common Tasks

| Task              | File                         | Pattern                        |
| ----------------- | ---------------------------- | ------------------------------ |
| Create page       | `(frontend)/name/page.tsx`   | Server component               |
| Create API        | `api/name/route.ts`          | Next.js Route Handler          |
| Add dynamic route | `(frontend)/[slug]/page.tsx` | Dynamic segment                |
| Access Payload    | `page.tsx`                   | `await getPayload({ config })` |

## Related

- [`src/ui/web/`](../ui/web/README.md) - Web components
- [`src/server/`](../server/README.md) - Server configuration
- [`AGENTS.md`](../../AGENTS.md) - Next.js + Payload patterns
