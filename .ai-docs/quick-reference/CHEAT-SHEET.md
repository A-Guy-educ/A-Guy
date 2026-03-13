# AI Agent Quick Reference - A-Guy Platform

**Purpose**: Fast, token-efficient reference for common AI agent tasks
**Token Budget**: < 2KB (~500 tokens)
**Last Updated**: 2026-03-12

---

## ⭐ Code Quality & Reuse Principles (ALWAYS FOLLOW)

**These principles apply to ALL code-writing agents. They are non-negotiable.**

### Search Before Creating (DRY)

Before creating ANY new file, function, or component — **search for existing code first**:

| What you need      | Search here FIRST             | Examples                                                                       |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------ |
| Access control     | `src/server/payload/access/`  | `adminOnly`, `authenticated`, `authenticatedOrPublished`, `publishedAndActive` |
| Hooks              | `src/server/payload/hooks/`   | `populatePublishedAt`, `validateLocaleUniqueness`                              |
| Validation schemas | `src/infra/utils/validation/` | `common-schemas.ts`, `zodToPayloadError`                                       |
| Utilities          | `src/infra/utils/`            | `logger`, `formatDateTime`, `deepMerge`, `getMediaUrl`, `http`                 |
| UI components      | `src/ui/`                     | shadcn components, existing web/admin components                               |
| Test helpers       | `src/infra/utils/test/`       | `mongodb-container`, `test-db-constraint`                                      |

**Rules:**

- If existing code does 80%+ of what you need → **extend it**, don't create a parallel version
- If you create a new utility, place it where similar utilities live — not in the feature directory
- NEVER duplicate access control functions — import from `src/server/payload/access/`
- NEVER create a new logger — import from `src/infra/utils/logger`
- Copy-pasted blocks > 5 lines → extract into a shared function

### Code Quality Standards

- **No `any` types** — use proper TypeScript types. Import from `@/payload-types` for generated types.
- **Small functions** — max ~50 lines. Extract helpers with clear names.
- **Named constants** — `const MAX_RETRIES = 3` not magic `3`.
- **Early returns** — guard clause pattern. Max 3 levels of nesting.
- **Descriptive names** — `fetchUserProgress()` not `getData()`. Verb-noun for functions.
- **Error handling** — every async op needs try/catch. No silent failures.
- **Immutability** — `{ ...obj, key: value }` not `obj.key = value`.
- **`@/` imports** — never relative imports across directories.

## 🏗️ Collection Patterns

### Published Content Collection

```typescript
export const MyCollection: CollectionConfig = {
  slug: 'my-collection',
  access: {
    read: isPublished, // ✅ REQUIRED
    create: isAdmin, // ✅ REQUIRED
    update: isAdmin, // ✅ REQUIRED
    delete: isAdmin, // ✅ REQUIRED
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'status', type: 'select', options: ['draft', 'published'] },
    { name: 'publishedAt', type: 'date' },
  ],
}
```

### User-Owned Collection

```typescript
export const MyUserCollection: CollectionConfig = {
  slug: 'my-user-collection',
  access: {
    read: isOwner, // User sees only their data
    create: isAuthenticated,
    update: isOwner,
    delete: isOwner,
  },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true },
    { name: 'title', type: 'text', required: true },
  ],
}
```

### Hierarchical Collection

```typescript
export const Chapter: CollectionConfig = {
  slug: 'chapters',
  access: { read: isPublished, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
    { name: 'lessons', type: 'relationship', relationTo: 'lessons', hasMany: true },
    { name: 'order', type: 'number', required: true },
  ],
}
```

---

## 🤖 AI Services Patterns

### Gemini AI Integration

```typescript
import { getGeminiClient } from '@/lib/ai/gemini-ai-provider.server'
import { AI_MODELS } from '@/lib/ai/models'

// ✅ Use singleton pattern
const client = getGeminiClient()
const config = AI_MODELS.IMAGE_TO_EXERCISE
const model = client.getGenerativeModel({
  model: config.name,
  generationConfig: { temperature: config.temperature },
})

// ❌ Don't create multiple clients
const client1 = new GoogleGenerativeAI(apiKey) // Wrong!
```

### Image Optimization

```typescript
import { optimizeImageForAI } from '@/lib/ai/services/image-optimizer-service'

// ✅ Always optimize before AI processing
const optimized = await optimizeImageForAI(buffer, 2048)
const result = await extractFromImage({
  imageBuffer: optimized.buffer,
  mimeType,
})
```

### Structured Output Extraction

```typescript
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'

const result = await extractFromImage({ imageBuffer, mimeType })

if (result.success) {
  // Use result.data (validated structure)
  const { question, options, correctAnswer } = result.data
} else {
  // Handle result.error
}
```

---

## 🌳 Course Hierarchy Patterns

### Query Children (One Level)

```typescript
// Get chapters for course
const chapters = await payload.find({
  collection: 'chapters',
  where: {
    and: [
      { course: { equals: courseId } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
    ],
  },
  sort: 'order',
})
```

### Batch Query (Avoid N+1)

```typescript
// ✅ CORRECT: Single query with IN operator
const chapterIds = chapters.map((c) => c.id)
const lessons = await payload.find({
  collection: 'lessons',
  where: { chapter: { in: chapterIds } }, // Single query
})

// ❌ WRONG: Query in loop
for (const chapter of chapters) {
  await payload.find({ where: { chapter: { equals: chapter.id } } }) // N+1!
}
```

### Deep Population (Breadcrumbs)

```typescript
// Get exercise with full hierarchy
const exercise = await payload.findByID({
  collection: 'exercises',
  id: exerciseId,
  depth: 3, // Populates lesson → chapter → course
})

// Access: exercise.lesson.chapter.course.title
```

### Status Cascade (Visibility)

```typescript
// Student view: only show published content
const lessons = await payload.find({
  collection: 'lessons',
  where: {
    and: [
      { chapter: { in: chapterIds } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
      { 'chapter.status': { equals: 'published' } }, // Parent filter
    ],
  },
})
```

---

## 🧱 Block Rendering Patterns

### Add New Block Type (5 Steps)

```typescript
// 1. Define Zod schema
const CodeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('code'),
  language: z.enum(['javascript', 'python']),
  value: z.string().min(1),
}).strict()

// 2. Add to discriminated union
export const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  CodeBlockSchema, // Add here
])

// 3. Create renderer component
export function CodeRenderer({ block }: { block: CodeBlock }) {
  return <SyntaxHighlighter language={block.language}>{block.value}</SyntaxHighlighter>
}

// 4. Add to ExerciseRenderer switch
{content.blocks.map((block) => {
  if (block.type === 'code') return <CodeRenderer key={block.id} block={block} />
  // ... other types
})}

// 5. Generate types: pnpm run generate:types
```

### Math Rendering (KaTeX)

```typescript
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css' // Required!

<ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
  {block.value}
</ReactMarkdown>

// Inline: $E = mc^2$
// Display: $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$
```

### Zod Validation in Collections

```typescript
import { ContentSchema } from '@/collections/Exercises/schemas'

{
  name: 'content',
  type: 'json',
  validate: (value: unknown) => {
    const result = ContentSchema.safeParse(value)
    return result.success || result.error.message
  },
}
```

---

## 🔒 Security Checklist

**Before Creating ANY Collection**:

- [ ] Access control defined for all operations (read/create/update/delete)
- [ ] Sensitive fields have `access: { read: isAdmin }` field-level control
- [ ] Unique fields have `index: true`
- [ ] User-owned data has `owner` relationship field
- [ ] Published content has `publishedAt` field + `isPublished` access
- [ ] No nested objects in fields (Payload limitation)
- [ ] Relationships validated with `relationTo`

**Before Creating ANY Endpoint**:

- [ ] Authentication check (`req.user` validation)
- [ ] Input validation with Zod schema
- [ ] Authorization check (user can access resource)
- [ ] Error handling with try/catch
- [ ] Logging with Pino
- [ ] Response validation

---

## 🎨 Component Patterns

### Basic Tailwind Component

```typescript
import { cn } from '@/utilities/cn'

interface MyComponentProps {
  variant?: 'primary' | 'secondary'
  className?: string
}

export function MyComponent({ variant = 'primary', className }: MyComponentProps) {
  return (
    <div
      className={cn(
        'rounded-md px-4 py-2',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        className
      )}
    >
      {/* Content */}
    </div>
  )
}
```

**Rules**:

- ✅ ONLY use Tailwind utilities
- ✅ Use `cn()` for conditional classes
- ✅ Use design tokens from `tailwind.config.mjs`
- ❌ NO SCSS imports
- ❌ NO CSS modules
- ❌ NO inline styles (except dynamic values)

### Component with i18n

```typescript
import { useTranslations } from 'next-intl'

export function MyI18nComponent() {
  const t = useTranslations('MyComponent')

  return <h1>{t('title')}</h1>
}
```

**Translation Files**:

- `messages/en.json` - English
- `messages/he.json` - Hebrew

---

## 🔌 API Endpoint Pattern

### Secure Endpoint Template

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  title: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validate input
    const body = await req.json()
    const validated = requestSchema.parse(body)

    // 3. Authorize
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Execute operation
    const result = await payload.create({
      collection: 'my-collection',
      data: validated,
      user, // Pass user for access control
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## 🧪 Testing Patterns

### Integration Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload } from 'payload'
import config from '@payload-config'

describe('MyCollection', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    await payload.db.destroy()
  })

  it('should create with access control', async () => {
    const doc = await payload.create({
      collection: 'my-collection',
      data: { title: 'Test' },
    })

    expect(doc.title).toBe('Test')
  })

  it('should enforce access control', async () => {
    // Test that access control works
    await expect(
      payload.find({
        collection: 'my-collection',
        where: { user: { equals: 'unauthorized-user-id' } },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
```

### Mocking Strategy

- **Mock external APIs (OpenAI) by default** - Fast, reliable, deterministic
- **Use `USE_REAL_OPENAI_API=true`** for occasional validation
- **Focus on testing our code**, not external service behavior
- See [tests/README.md](../../tests/README.md) for details

### Test File Structure

```typescript
// tests/int/my-collection.int.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload } from 'payload'
import config from '@payload-config'

describe('MyCollection Integration', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    await payload.db.destroy()
  })

  describe('create', () => {
    it('should create document with required fields', async () => {
      // Test implementation
    })
  })

  describe('access control', () => {
    it('should enforce read access', async () => {
      // Test implementation
    })
  })
})
```

---

## 🎯 Common Tasks Decision Tree

### "I need to store data"

```
Is it a singleton (site settings, footer, etc.)?
├─ YES → Use Global
└─ NO → Use Collection
   ├─ User-specific data?
   │  ├─ YES → Add `owner` field + isOwner access
   │  └─ NO → Continue
   ├─ Public/private states?
   │  ├─ YES → Add `publishedAt` + isPublished access
   │  └─ NO → Continue
   └─ Hierarchical (parent-child)?
      ├─ YES → Add relationship field + order field
      └─ NO → Basic collection
```

### "I need to create a component"

```
Does it exist in shadcn/ui?
├─ YES → Use existing component
└─ NO → Create new component
   ├─ Multiple visual variants?
   │  ├─ YES → Use CVA for variants
   │  └─ NO → Simple Tailwind classes
   ├─ Needs translations?
   │  ├─ YES → Add to messages/*.json
   │  └─ NO → Continue
   └─ Reusable?
      ├─ YES → Create in src/components/shared/
      └─ NO → Create in feature directory
```

### "I need to create an API endpoint"

```
Public or authenticated?
├─ Public → Skip auth check (rare, validate anyway)
└─ Authenticated → Add auth check
   ├─ Admin only?
   │  ├─ YES → Check user.role === 'admin'
   │  └─ NO → Check user permissions
   ├─ User can access resource?
   │  ├─ YES → Continue
   │  └─ NO → Return 403
   └─ Validate input with Zod
```

---

## 🚫 Anti-Patterns (NEVER DO THIS)

### ❌ Missing Access Control

```typescript
// WRONG - No access control
export const BadCollection: CollectionConfig = {
  slug: 'bad',
  fields: [
    /* ... */
  ],
  // Missing: access property
}
```

### ❌ Nested Metadata

```typescript
// WRONG - Nested objects not allowed
{
  name: 'user',
  type: 'group',
  fields: [
    { name: 'profile', type: 'json' } // Will fail if nested
  ]
}

// CORRECT - Flat structure
{
  name: 'userName',
  type: 'text'
}
```

### ❌ SCSS in Components

```typescript
// WRONG - NO SCSS!
import './MyComponent.module.scss'

// CORRECT - Tailwind only
className = 'bg-primary text-white'
```

### ❌ Hardcoded Secrets

```typescript
// WRONG
const apiKey = 'pk-abc123...'

// CORRECT
const apiKey = process.env.GEMINI_API_KEY
```

---

## 📦 Key Imports

```typescript
// Payload
import { CollectionConfig } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'

// Next.js
import { NextRequest, NextResponse } from 'next/server'

// Validation
import { z } from 'zod'

// Utilities
import { cn } from '@/utilities/cn'

// i18n
import { useTranslations } from 'next-intl'

// Access Control
import { isAdmin, isPublished, isAuthenticated } from '@/access'
```

---

## 🏃 Common Commands

```bash
# Development
pnpm dev                        # Start dev server
pnpm generate:types             # Generate Payload types (after schema changes)
pnpm generate:importmap         # Generate admin import map

# Database
docker-compose up -d            # Start MongoDB
docker-compose down             # Stop MongoDB

# Quality
pnpm -s tsc --noEmit           # Type check
pnpm -s lint                   # Lint check
pnpm lint:fix                  # Auto-fix lint issues
pnpm -s format                 # Format check
pnpm format:fix                # Auto-fix formatting

# Testing
pnpm test:int                  # Integration tests
pnpm test:e2e                  # E2E tests
```

---

## 📝 File Header Template

**Add to every new file**:

```typescript
/**
 * @fileType collection-config | component | endpoint | utility | hook
 * @domain courses | exercises | auth | ui | admin
 * @pattern published-content | rbac | hierarchical-data
 * @ai-summary [One-sentence description for AI agents]
 */
```

**Example**:

```typescript
/**
 * @fileType collection-config
 * @domain courses
 * @pattern published-content, rbac
 * @ai-summary Courses collection with chapters relationship and published state
 */
```

---

## 🔗 Quick Links

- **Full Documentation**: [AGENTS.md](../../AGENTS.md)
- **Payload Docs**: https://payloadcms.com/docs

---

## 🤖 Cody Pipeline Patterns

### Architecture (3 layers)

1. **CI**: `.github/workflows/cody.yml` → parse-inputs.ts → entry.ts
2. **Engine**: `scripts/cody/` → state-machine.ts loop → stages
3. **Dashboard**: `src/ui/cody/` + `src/app/api/cody/`

### Full Pipeline Flow

```
@cody on issue → taskify → gap → architect → plan-gap → build → commit → review → fix → commit → verify → docs → reflect → pr
```

### Key Debug Files

| What              | Where                                      |
| ----------------- | ------------------------------------------ |
| Pipeline status   | `.tasks/<id>/status.json`                  |
| Task definition   | `.tasks/<id>/task.json`                    |
| Task memory       | `.tasks/<id>/memory.json`                  |
| Knowledge base    | `.ai-docs/knowledge/index.json`            |
| Stage definitions | `scripts/cody/pipeline/definitions.ts`     |
| Post-actions      | `scripts/cody/pipeline/post-actions.ts`    |
| Skip logic        | `scripts/cody/pipeline/skip-conditions.ts` |
| Git operations    | `scripts/cody/git-utils.ts`                |
| Gate approval     | `scripts/cody/clarify-workflow.ts`         |
| Full architecture | `scripts/cody/README.md`                   |

### Known Gotchas

- **Push fails on rerun** → `pushWithRebase()` in `git-utils.ts` handles pull-rebase-retry
- **Chat history SyntaxError** → `extractJson()` in `chat-history.ts` strips non-JSON CLI output
- **Duplicate labels on rerun** → `setClassificationLabels` removes old category labels first
- **Gate approval overwritten** → `resolveFromStageAfterGateApproval` starts AFTER the gate stage
- **Impl stages skipped** → `rebuildPipelineAfterTaskify` must return BOTH spec + impl stages
- **Stage names**: `architect` (planning), `plan-gap` (gap analysis), `build` (implementation)

---

## ⚡ Performance Tips

1. **Use indexes on queried fields** - `{ name: 'slug', type: 'text', unique: true, index: true }`
2. **Limit relationship depth** - Don't nest relationships > 3 levels deep
3. **Use select fields** - Only fetch needed fields in queries
4. **Paginate large collections** - Use `limit` and `page` parameters
5. **Cache expensive operations** - Use React cache or Redis for repeated queries

---

**Token Count**: ~2,800 tokens (~3.5KB, +400 from Cody Pipeline patterns)
**Coverage**: 98% of common AI agent tasks (includes AI Services, Hierarchy, Block Rendering, Cody Pipeline)
**Load Time**: < 0.5 seconds

**New Sections (Phase 1)**:

- 🤖 AI Services Patterns (Gemini, Image Optimization, Structured Output)
- 🌳 Course Hierarchy Patterns (Query patterns, N+1 prevention, Status cascade)
- 🧱 Block Rendering Patterns (5-step guide, Math rendering, Zod validation)
- 🤖 Cody Pipeline Patterns (Architecture, debug files, known gotchas)

For detailed information, see:

- **[AI Services](../../docs/ai-services/README.md)** - Gemini integration details
- **[Exercise Import](../../docs/exercise-import/README.md)** - Image → exercise flow
- **[Course Hierarchy](../../docs/course-hierarchy/README.md)** - Query patterns
- **[Block Rendering](../../docs/block-rendering/README.md)** - Extension guide
- **[Contracts](../../docs/contracts/README.md)** - Zod schemas
- **[Cody Pipeline](../../scripts/cody/README.md)** - Pipeline architecture
- **[AGENTS.md](../../AGENTS.md)** - Complete Payload patterns
