# Component Architecture

This directory contains all React components for the A-Guy platform, organized by purpose and usage context.

## Directory Structure

```
src/components/
├── ui/                          # shadcn/ui base components
├── admin/                       # Payload admin panel components
├── ExerciseRenderer/            # Exercise system components
├── LanguageSwitcher/            # i18n language toggle
├── Pagination/                  # List pagination
├── CollectionArchive/           # Course/content lists
├── Card/                        # Content cards
├── AdminBar/                    # Frontend admin toolbar
├── BeforeLogin/                 # Admin login customization
├── BeforeDashboard/             # Admin dashboard customization
└── PayloadRedirects/            # Redirect handling
```

## Component Categories

### 1. UI Components (`ui/`)

**Purpose:** Reusable, styled base components from [shadcn/ui](https://ui.shadcn.com)

**Key Components:**

- `button.tsx` - Button variants (default, destructive, outline, ghost, link)
- `input.tsx` - Form input fields
- `textarea.tsx` - Multi-line text input
- `select.tsx` - Dropdown selection
- `checkbox.tsx` - Checkbox input
- `card.tsx` - Content container with header/footer
- `badge.tsx` - Status/tag badges
- `pagination.tsx` - Page navigation
- `breadcrumb.tsx` - Navigation breadcrumbs
- `command.tsx` - Command palette/search
- `label.tsx` - Form labels
- `toaster.tsx` - Toast notifications

**Styling:**

- Uses Tailwind CSS with CSS variables for theming
- Supports RTL (Right-to-Left) for Hebrew
- Fully responsive

**Adding New UI Components:**

```bash
# Use the add-ui-component skill
/add-ui-component dialog

# Or manually with shadcn CLI
pnpm dlx shadcn@latest add dialog
```

See [AGENTS.md - shadcn/ui Integration](../../AGENTS.md#shadcnui-integration) for details.

### 2. Admin Components (`admin/`)

**Purpose:** Custom components for Payload CMS admin panel

**Key Components:**

- `ChapterBreadcrumbField/` - Shows course hierarchy in Chapter editor
- `LessonBreadcrumbField/` - Shows course → chapter hierarchy in Lesson editor
- `ExerciseContentEditor/` - Rich editor for exercise content blocks
- `AnswerSpecJsonField/` - JSON editor for answer specifications

**Patterns:**

```typescript
// Admin components are Server Components by default
export default async function MyAdminField({ field, payload }) {
  // Can directly query Payload
  const data = await payload.find({ collection: 'courses' })

  return <div>{/* Render field */}</div>
}
```

**Usage in Collections:**

```typescript
// In collection config
fields: [
  {
    name: 'myField',
    type: 'ui',
    admin: {
      components: {
        Field: '/components/admin/MyField',
      },
    },
  },
]
```

After adding admin components, regenerate import map:

```bash
pnpm generate:importmap
```

### 3. Exercise System (`ExerciseRenderer/`)

**Purpose:** Render and validate interactive exercises

**Structure:**

```
ExerciseRenderer/
├── index.tsx                    # Main renderer component
├── ExerciseClient.tsx           # Client-side interaction logic
├── blocks/                      # Exercise block type renderers
│   ├── MultipleChoiceBlock.tsx
│   ├── TrueFalseBlock.tsx
│   └── FreeResponseBlock.tsx
├── utils/                       # Exercise utilities
│   └── checkAnswer.ts           # Answer validation logic
└── ErrorBoundary/               # Error handling
```

**Exercise Types:**

- **MCQ (Multiple Choice)** - Single or multi-select questions
- **True/False** - Statement validation with sections
- **Free Response** - Text input answers

**Contract-Based Validation:**

```typescript
import { exerciseBlockSchema } from '@/contracts'

// Validate exercise structure
const result = exerciseBlockSchema.safeParse(exerciseData)
if (!result.success) {
  // Handle validation errors
}
```

See [AGENTS.md - Exercise System](../../AGENTS.md#exercise-system-architecture) for complete architecture.

### 4. Feature Components

**LanguageSwitcher/** - Bilingual navigation (English ↔ Hebrew)

```typescript
'use client' // Client component for interactivity

export function LanguageSwitcher() {
  const { locale } = useParams()
  const pathname = usePathname()

  // Toggle between 'en' and 'he'
}
```

**CollectionArchive/** - Course/content listing

```typescript
// Server component - fetches data directly
export async function CollectionArchive() {
  const courses = await payload.find({
    collection: 'courses',
    where: { isActive: { equals: true } },
  })

  return <div>{/* Render course cards */}</div>
}
```

**Pagination/** - Page navigation

```typescript
// Client component for navigation
export function Pagination({ page, totalPages }) {
  const router = useRouter()
  // Handle page changes
}
```

**Card/** - Reusable content card

```typescript
// Server component
export function Card({ course }) {
  return (
    <CardRoot>
      <CardHeader>{course.title}</CardHeader>
      <CardContent>{course.description}</CardContent>
    </CardRoot>
  )
}
```

**AdminBar/** - Frontend admin toolbar

```typescript
// Appears on frontend for authenticated admins
// Quick links to edit current page content
```

### 5. Admin Customization Components

**BeforeLogin/** - Custom admin login screen

```typescript
// Replaces default Payload login UI
export function BeforeLogin() {
  return <div>{/* Custom branding, messaging */}</div>
}
```

**BeforeDashboard/** - Dashboard enhancements

```typescript
// Adds seed data button and custom dashboard content
export function BeforeDashboard() {
  return <SeedButton />
}
```

## Client vs. Server Components

**Default:** All components are Server Components unless marked with `'use client'`

**Use Client Components when:**

- Need interactivity (onClick, onChange, etc.)
- Use React hooks (useState, useEffect, etc.)
- Access browser APIs (localStorage, window, etc.)
- Subscribe to contexts that change (router, params)

**Use Server Components when:**

- Fetching data directly from Payload
- No interactivity needed
- Can be static or cached
- SEO-critical content

**Pattern:**

```typescript
// ServerComponent.tsx (no directive = server component)
import { ClientComponent } from './ClientComponent'

export async function ServerComponent() {
  const data = await fetchData() // ✅ Direct data fetching

  return <ClientComponent initialData={data} />
}

// ClientComponent.tsx
'use client'

export function ClientComponent({ initialData }) {
  const [state, setState] = useState(initialData)
  // ✅ Hooks and interactivity
}
```

See [AGENTS.md - Server vs Client Components](../../AGENTS.md#server-vs-client-components) for complete guide.

## Translation Patterns

All user-facing text should be translatable (English + Hebrew).

**Setup:**

```typescript
import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('namespace')

  return <h1>{t('title')}</h1>
}
```

**Translation Files:**

- `messages/en.json` - English translations
- `messages/he.json` - Hebrew translations

**Example:**

```json
// messages/en.json
{
  "courses": {
    "title": "Available Courses",
    "viewCourse": "View Course"
  }
}

// messages/he.json
{
  "courses": {
    "title": "קורסים זמינים",
    "viewCourse": "צפייה בקורס"
  }
}
```

**Always update both files when adding new text.**

See [AGENTS.md - Internationalization](../../AGENTS.md#internationalization-i18n) for complete guide.

## Styling Conventions

### Tailwind CSS

Use Tailwind utility classes for styling:

```typescript
<div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-card text-card-foreground">
  <h2 className="text-2xl font-bold">Title</h2>
  <Button variant="outline">Action</Button>
</div>
```

### RTL Support

Components automatically support RTL layout for Hebrew:

```typescript
// Use logical properties
className = 'ms-4' // margin-inline-start (left in LTR, right in RTL)
className = 'me-4' // margin-inline-end (right in LTR, left in RTL)

// Instead of directional
className = 'ml-4' // ❌ Don't use (always left margin)
className = 'mr-4' // ❌ Don't use (always right margin)
```

### Design Tokens

Colors and spacing use CSS variables (defined in `app/globals.css`):

```typescript
className = 'bg-background text-foreground' // Automatic theming
className = 'border-border' // Consistent borders
className = 'text-muted-foreground' // Secondary text
```

## Component Development Workflow

### 1. Create New Component

```bash
# For UI component (from shadcn)
/add-ui-component <component-name>

# For custom component
# Create file in appropriate directory
touch src/components/MyComponent/index.tsx
```

### 2. Decide Server vs Client

```typescript
// Server component (default)
export function MyServerComponent() {
  // No 'use client' directive
}

// Client component
;('use client')

export function MyClientComponent() {
  // Interactive logic
}
```

### 3. Add Translations

```json
// messages/en.json
{
  "myComponent": {
    "title": "My Title"
  }
}

// messages/he.json
{
  "myComponent": {
    "title": "הכותרת שלי"
  }
}
```

### 4. Use in Pages/Layouts

```typescript
import { MyComponent } from '@/components/MyComponent'

export default function Page() {
  return <MyComponent />
}
```

### 5. Test

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Run dev server
pnpm dev
```

## Common Patterns

### Fetching Data (Server Components)

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

export async function CourseList() {
  const payload = await getPayload({ config })

  const courses = await payload.find({
    collection: 'courses',
    where: { isActive: { equals: true } },
    sort: 'order',
  })

  return (
    <div>
      {courses.docs.map((course) => (
        <div key={course.id}>{course.title}</div>
      ))}
    </div>
  )
}
```

### Form Handling (Client Components)

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function MyForm() {
  const [value, setValue] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Handle submission
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Loading States

```typescript
import { Suspense } from 'react'

export function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AsyncComponent />
    </Suspense>
  )
}
```

### Error Handling

```typescript
'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

## Related Documentation

- [AGENTS.md](../../AGENTS.md) - Comprehensive development guide
- [shadcn/ui Docs](https://ui.shadcn.com) - UI component library
- [Next.js Docs](https://nextjs.org/docs) - Framework documentation
- [Payload Docs](https://payloadcms.com/docs) - CMS documentation
- [next-intl Docs](https://next-intl-docs.vercel.app) - Internationalization

## Quick Reference Commands

```bash
# Start dev server
pnpm dev

# Add UI component
/add-ui-component <name>

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test
```
