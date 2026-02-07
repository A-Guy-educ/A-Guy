# File Structure Guide

This guide documents the proper file structure for the A-Guy project and provides migration patterns for moving components from the deprecated `src/components/` directory to the new `src/ui/` directory.

## Directory Structure

```
src/
├── app/                       # Next.js App Router
│   ├── (frontend)/            # Frontend routes (public-facing)
│   └── (payload)/            # Payload admin routes
├── collections/              # Payload collection configurations
├── globals/                  # Payload global configurations
├── ui/                      # React components (PAYLOAD-FIRST)
│   ├── admin/               # Payload admin UI components
│   │   └── [collection]/
│   │       └── [component]/
│   └── web/                  # Frontend/consumer UI components
│       ├── [feature]/
│       │   └── [component]/
│       └── components/       # Shared web components
├── hooks/                    # Custom React hooks
├── access/                   # Access control functions
├── server/                   # Server-side code
│   ├── api/                 # API routes
│   ├── payload/             # Payload CMS configurations
│   │   ├── collections/    # Collection configs
│   │   ├── globals/        # Global configs
│   │   ├── hooks/          # Hook functions
│   │   ├── access/         # Access control
│   │   └── blocks/         # Block configurations
│   └── services/           # Business logic
└── payload.config.ts        # Main Payload config
```

## UI Component Guidelines

### When to Use Each Directory

- **`src/ui/web/`**: Frontend/consumer-facing React components
  - Public pages and layouts
  - Course-related components
  - Chat and messaging components
  - Landing page components

- **`src/ui/admin/`**: Payload admin panel components
  - Custom field components
  - Collection list/edit view customizations
  - Dashboard components
  - Settings page components

### Naming Conventions

1. **Component Files**: Use PascalCase for component files
   - ✅ `src/ui/web/components/HealthBadge.tsx`
   - ✅ `src/ui/web/courses/PDFViewer/PDFEmbed.tsx`

2. **Directory Structure**: Group by feature/domain

   ```
   src/ui/web/
   ├── courses/
   │   ├── CourseCard/
   │   └── PDFViewer/
   ├── chat/
   │   ├── ChatInterface/
   │   └── ChatMessage/
   └── components/
       ├── Button/
       └── Modal/
   ```

3. **Component Structure**: Each component should have:
   - Main component file (`index.tsx` or `[ComponentName].tsx`)
   - Styles file (`index.scss` - optional)
   - Types file (`types.ts` - optional)

   ```
   src/ui/web/components/Button/
   ├── index.tsx
   ├── index.scss
   └── types.ts
   ```

## Migration Guide: src/components/ → src/ui/

### Background

The `src/components/` directory is **deprecated**. All new components should be created in `src/ui/web/` or `src/ui/admin/`. Existing components should be migrated following these patterns.

### Migration Patterns

#### Pattern 1: UI Components

**From:**

```
src/components/ui/HealthBadge.tsx
```

**To:**

```
src/ui/web/components/HealthBadge.tsx
```

**Rule**: `src/components/ui/` → `src/ui/web/components/`

#### Pattern 2: Feature Components

**From:**

```
src/components/courses/PDFViewer/PDFEmbed.tsx
```

**To:**

```
src/ui/web/courses/PDFViewer/PDFEmbed.tsx
```

**Rule**: `src/components/[feature]/` → `src/ui/web/[feature]/`

#### Pattern 3: Admin Components

**From:**

```
src/components/admin/CustomField.tsx
```

**To:**

```
src/ui/admin/collections/[collection-name]/CustomField.tsx
```

**Rule**: `src/components/admin/` → `src/ui/admin/[collection-or-feature]/`

### Manual Migration Steps

1. **Create the new directory structure**:

   ```bash
   mkdir -p src/ui/web/[feature]/[component]
   ```

2. **Move the component file**:

   ```bash
   mv src/components/[old-path]/[Component].tsx src/ui/web/[new-path]/[Component].tsx
   ```

3. **Update imports** in all files that reference the component:

   ```typescript
   // Old import
   import { HealthBadge } from '@/components/ui/HealthBadge'

   // New import
   import { HealthBadge } from '@/ui/web/components/HealthBadge'
   ```

4. **Update Payload admin import map** (if applicable):

   ```bash
   pnpm generate:importmap
   ```

5. **Verify with lint and type check**:
   ```bash
   pnpm lint:fix
   pnpm tsc --noEmit
   ```

### Auto-Fix with ESLint

The project includes an ESLint rule `eslint-plugin-aguy/rules/file-location.js` that can help identify files that need migration.

**Run lint to see migration suggestions:**

```bash
pnpm lint
```

**Enable auto-fix (adds TODO comments):**

```bash
pnpm lint:fix
```

### Common Import Patterns

#### Next.js App Router Components

```typescript
// Frontend component
import { CourseCard } from '@/ui/web/courses/CourseCard'

// Admin component
import { CustomField } from '@/ui/admin/collections/posts/CustomField'
```

#### Payload Admin Components

```typescript
// In payload.config.ts or collection config
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    components: {
      Field: '@/ui/admin/collections/posts/CustomField',
    },
  },
}
```

#### Dynamic Imports

```typescript
import dynamic from 'next/dynamic'

const PDFEmbed = dynamic(() => import('@/ui/web/courses/PDFViewer/PDFEmbed'), { ssr: false })
```

## Deprecated Directories

### src/components/

**Status**: Deprecated

All new components should be placed in `src/ui/web/` or `src/ui/admin/`. Existing components will be migrated gradually.

### src/ui/shared/

**Status**: Deprecated

The `src/ui/shared/` directory is no longer used. Components that were there have been migrated to `src/ui/web/components/` or removed.

## ESLint Rule Configuration

The `file-location` rule can be configured in `eslint-plugin-aguy/rules/file-location.js`:

```javascript
{
  rules: {
    'aguy/file-location': [
      'error',
      {
        // Allow certain files to remain in src/components/
        allowList: [
          'src/components/README.md',
          'src/components/legacy/', // Legacy components pending migration
        ],
        // Disable migration suggestions
        suggestMigration: false,
      },
    ],
  },
}
```

## Best Practices

1. **Feature-Driven Organization**: Group components by feature/domain, not by type
2. **Co-located Files**: Keep related files (types, styles, tests) with the component
3. **Export Barrel**: Use `index.ts` for re-exports from feature directories
4. **Type Safety**: Always use TypeScript with proper types
5. **Server/Client Separation**: Use 'use client' directive only when needed

## Example: Creating a New Component

### 1. Create the directory structure:

```bash
mkdir -p src/ui/web/courses/CourseCard
```

### 2. Create the component files:

**index.tsx:**

```typescript
'use client'

import './index.scss'

interface CourseCardProps {
  title: string
  description: string
  onEnroll?: () => void
}

export function CourseCard({ title, description, onEnroll }: CourseCardProps) {
  return (
    <div className="course-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <button onClick={onEnroll}>Enroll</button>
    </div>
  )
}
```

**index.scss:**

```scss
.course-card {
  @apply border rounded-lg p-4;

  h3 {
    @apply text-lg font-semibold;
  }
}
```

**types.ts:**

```typescript
export interface CourseCardProps {
  title: string
  description: string
  onEnroll?: () => void
}
```

### 3. Export from feature barrel (optional):

**src/ui/web/courses/index.ts:**

```typescript
export { CourseCard } from './CourseCard'
// Add other course-related exports
```

## References

- [AGENTS.md](../AGENTS.md) - Payload CMS development rules
- [src/components/README.md](./components/README.md) - Original component documentation
- [ESLint Plugin Documentation](../eslint-plugin-aguy/README.md)
