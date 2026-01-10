# Collections Overview

This directory contains all Payload CMS collection configurations for the A-Guy platform.

## Available Collections

### Core Content Collections

- **[Courses.ts](Courses.ts)** - Top-level course containers
  - Purpose: Organize content into distinct courses
  - Access: Public read, authenticated write
  - Key fields: `courseLabel`, `title`, `slug`, `categories`, `order`, `isActive`
  - Auto-generates slug from title

- **[Chapters.ts](Chapters.ts)** - Course chapters/modules
  - Purpose: Group related lessons within a course
  - Access: Public read, authenticated write
  - Key fields: `chapterLabel`, `title`, `course` (relationship), `order`
  - Hierarchical: belongs to a Course

- **[Lessons.ts](Lessons.ts)** - Individual lessons
  - Purpose: Core learning content units
  - Access: Public read, authenticated write
  - Key fields: `lessonLabel`, `title`, `chapter` (relationship), `content` (layout builder)
  - Contains exercise blocks via layout builder

- **[Categories.ts](Categories.ts)** - Content categorization
  - Purpose: Tag courses with topics/themes
  - Access: Public read, authenticated write
  - Key fields: `categoryLabel`, `title`

### Exercise System Collections

- **[ExerciseAssets.ts](ExerciseAssets.ts)** - Exercise-specific media
  - Purpose: Store images, audio, video for exercises
  - Access: Public read, authenticated write
  - Special: Dedicated upload directory (`exerciseAssets/`)
  - Used by: Exercise blocks in lessons

### Supporting Collections

- **[Media.ts](Media.ts)** - General media assets
  - Purpose: Images, documents for general content
  - Access: Public read, authenticated write
  - Upload directory: `media/`

- **[PricingPlans.ts](PricingPlans.ts)** - Subscription tiers
  - Purpose: Define pricing and feature sets
  - Access: Public read, authenticated write
  - Key fields: `name`, `price`, `features`, `isActive`

## Access Control Patterns

All collections use these access control functions:

```typescript
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

{
  access: {
    create: authenticated,  // Only authenticated users can create
    delete: authenticated,  // Only authenticated users can delete
    read: anyone,          // Anyone can read (including anonymous)
    update: authenticated, // Only authenticated users can update
  }
}
```

### Security Notes

- **Public Read**: All collections are readable by anyone (required for public frontend)
- **Authenticated Write**: Only admins can create/update/delete content
- **Row-level security**: Not currently implemented (all-or-nothing access)

## Field Reuse Patterns

### Common Fields

- **`createdByField`** - Automatically tracks who created the record

  ```typescript
  import { createdByField } from '../fields/createdBy'

  fields: [
    // ... other fields
    createdByField,
  ]
  ```

- **Label + Title Pattern** - Most collections use both:
  - `[type]Label`: Short identifier (e.g., `"COURSE-1"`)
  - `title`: Human-readable name

- **Slug Generation** - Auto-generated from title:
  ```typescript
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.title && !data?.slug) {
          data.slug = formatSlug(data.title)
        }
        return data
      },
    ],
  }
  ```

### Relationship Patterns

```typescript
// One-to-many: Course -> Chapters
{
  name: 'course',
  type: 'relationship',
  relationTo: 'courses',
  required: true,
  index: true,
}

// Many-to-many: Courses -> Categories
{
  name: 'categories',
  type: 'relationship',
  relationTo: 'categories',
  hasMany: true,
}
```

## Ordering & Hierarchy

Collections use an `order` field for explicit sorting:

```typescript
{
  name: 'order',
  type: 'number',
  required: true,
  defaultValue: 0,
  admin: {
    description: 'Display order (lower numbers appear first)',
  },
}
```

**Hierarchy:**

```
Course
  └── Chapter (ordered by `order`)
        └── Lesson (ordered by `order`)
              └── Exercise Block (via layout builder)
```

## Admin UI Configuration

### Display Settings

```typescript
admin: {
  useAsTitle: 'title',  // Field to show in admin lists
  defaultColumns: [      // Columns visible in list view
    'courseLabel',
    'title',
    'status',
    'updatedAt',
  ],
}
```

### Custom Admin Components

Some collections use custom admin UI components:

- **Custom field editors** - Enhanced editing experience (e.g., AnswerSpecJsonField, ExerciseContentEditor)

## Layout Builder Integration

**Lessons** use Payload's layout builder for flexible content:

```typescript
{
  name: 'content',
  type: 'blocks',
  blocks: [
    ExerciseBlock,
    // ... other block types
  ],
}
```

See [AGENTS.md](../../AGENTS.md#layout-builder-blocks) for block development patterns.

## When to Create a New Collection

**Create a new collection when:**

- Entity has independent lifecycle (can exist without parent)
- Needs its own access control rules
- Will be queried/filtered independently
- Has many-to-many relationships with other entities

**Use fields/groups instead when:**

- Data is tightly coupled to parent entity
- Always accessed together with parent
- Simple one-to-one relationship
- No need for independent querying

**Use blocks instead when:**

- Content structure varies by instance
- Needs flexible ordering/composition
- Part of a layout builder system

## Common Patterns

### Auto-generating Slugs

```typescript
const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()

hooks: {
  beforeChange: [
    ({ data }) => {
      if (data?.title && !data?.slug) {
        data.slug = formatSlug(data.title)
      }
      return data
    },
  ],
}
```

### Status & Visibility

```typescript
{
  name: 'isActive',
  type: 'checkbox',
  defaultValue: true,
  admin: {
    description: 'Whether this item is visible on the frontend',
  },
}
```

### Timestamps

Payload automatically adds:

- `createdAt` - Record creation time
- `updatedAt` - Last modification time

## Type Safety

After modifying collections, regenerate types:

```bash
pnpm generate:types
```

Types are generated to: `src/payload-types.ts`

## Related Documentation

- [AGENTS.md](../../AGENTS.md) - Comprehensive development guide
- [Payload Collections Docs](https://payloadcms.com/docs/configuration/collections) - Official documentation
- [Access Control](../../AGENTS.md#access-control) - Security patterns
- [Hooks](../../AGENTS.md#hooks) - Lifecycle hooks
- [Fields](../../AGENTS.md#fields) - Field types and validation

## Quick Reference Commands

```bash
# Start dev server (includes admin panel at /admin)
pnpm dev

# Regenerate types after schema changes
pnpm generate:types

# Check types
pnpm typecheck

# View MongoDB data
pnpm db:logs
```
