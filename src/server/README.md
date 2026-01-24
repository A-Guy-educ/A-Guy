# Server-Side Payload CMS

**@domain** backend
**@fileType** payload-config
**@ai-summary** Payload CMS configuration: collections, access, blocks, hooks, endpoints

---

## Structure

```
server/
├── payload/
│   ├── access/             # Access control functions (6 files)
│   ├── blocks/             # Lexical blocks (9 types)
│   ├── collections/        # Collection configs (11 collections)
│   ├── endpoints/          # Custom API endpoints
│   ├── fields/             # Custom field configs
│   ├── hooks/              # Collection hooks
│   ├── migrations/         # DB migrations
│   └── plugins/            # Payload plugins (MCP)
├── repos/
│   ├── mcp/                # MCP client integration
│   ├── queries/            # Database query utilities
│   └── tenant/             # Tenant resolution
├── services/               # Business logic services
├── constants/              # Server constants
└── errors.ts               # Custom error classes
```

## Collections

| Collection    | File                                   | Key Features           |
| ------------- | -------------------------------------- | ---------------------- |
| Users         | `payload/collections/Users/`           | Auth, roles, RBAC      |
| Courses       | `payload/collections/Courses.ts`       | Hierarchical, chapters |
| Chapters      | `payload/collections/Chapters.ts`      | Parent: Course         |
| Lessons       | `payload/collections/Lessons.ts`       | Parent: Chapter        |
| Exercises     | `payload/collections/Exercises/`       | Rich content, answers  |
| Posts         | `payload/collections/Posts/`           | Blog posts             |
| Pages         | `payload/collections/Pages/`           | Static pages           |
| Media         | `payload/collections/Media/`           | File uploads           |
| Categories    | `payload/collections/Categories.ts`    | Taxonomies             |
| UserProgress  | `payload/collections/UserProgress.ts`  | Progress tracking      |
| Conversations | `payload/collections/Conversations.ts` | Chat history           |

## Access Control Patterns

```typescript
// adminOnly - only admins can access
import { adminOnly } from '@/server/payload/access/adminOnly'

// authenticated - user must be logged in
import { authenticated } from '@/server/payload/access/authenticated'

// authenticatedOrPublished - public read for published
import { authenticatedOrPublished } from '@/server/payload/access/authenticatedOrPublished'

// adminOrSelf - admin or own document
import { adminOrSelf } from '@/server/payload/access/adminOrSelf'
```

## Collection Pattern: RBAC

```typescript
export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    create: adminOnly,
    read: authenticatedOrPublished,
    update: adminOrSelf,
    delete: adminOnly,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'chapters', type: 'relationship', hasMany: true, relationTo: 'chapters' },
  ],
}
```

## Collection Pattern: Hierarchical

```typescript
// Parent-child: Course -> Chapter -> Lesson
export const Chapters: CollectionConfig = {
  slug: 'chapters',
  fields: [
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
    { name: 'lessons', type: 'relationship', hasMany: true, relationTo: 'lessons' },
  ],
}
```

## Block Configurations

| Block        | Location                       | Purpose                 |
| ------------ | ------------------------------ | ----------------------- |
| Archive      | `payload/blocks/ArchiveBlock/` | Post archive list       |
| Banner       | `payload/blocks/Banner/`       | Hero banner             |
| CallToAction | `payload/blocks/CallToAction/` | CTA section             |
| Code         | `payload/blocks/Code/`         | Syntax highlighted code |
| Content      | `payload/blocks/Content/`      | Rich text content       |
| Form         | `payload/blocks/Form/`         | Contact form            |
| MediaBlock   | `payload/blocks/MediaBlock/`   | Media embed             |
| RelatedPosts | `payload/blocks/RelatedPosts/` | Related content         |

## Query Utilities

```typescript
// repos/queries/
import { getCourseBySlug } from '@/server/repos/queries/courses'
import { getChaptersByCourse } from '@/server/repos/queries/chapters'
import { getLessonsByChapter } from '@/server/repos/queries/lessons'
import { getUserProgress } from '@/server/repos/queries/userProgress'

// Usage
const course = await getCourseBySlug('intro-to-programming')
const chapters = await getChaptersByCourse(course.id)
```

## Custom Endpoints

```typescript
// payload/endpoints/seed/ - Database seeding
// payload/endpoints/exercises/ - Exercise import
// payload/endpoints/agent/ - AI chat endpoints

// Example endpoint pattern
export const myEndpoint: Endpoint = {
  path: '/my-endpoint',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Unauthorized', 401)
    const data = await req.payload.find({ collection: 'posts' })
    return Response.json(data)
  },
}
```

## Related Documentation

- [`AGENTS.md`](../../AGENTS.md) - Complete Payload patterns
- [`src/server/payload/collections/README.md`](./payload/collections/README.md) - Collection details
- [`src/infra/`](../infra/README.md) - Shared infrastructure
- [`src/ui/admin/exercise/README.md`](../ui/admin/exercise/README.md) - Admin components

## File Reference

| File                                | Purpose                  |
| ----------------------------------- | ------------------------ |
| `payload/access/*.ts`               | Access control functions |
| `payload/blocks/*/config.ts`        | Block configuration      |
| `payload/collections/Name/index.ts` | Collection config        |
| `payload/collections/Name/hooks.ts` | Collection hooks         |
| `repos/queries/*.ts`                | Database query helpers   |
| `repos/mcp/*/audit-service.ts`      | MCP audit logging        |
