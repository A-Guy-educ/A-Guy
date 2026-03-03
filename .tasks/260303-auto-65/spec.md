# Spec: Shared formatSlug Utility with Hebrew Support

## Overview

Refactor duplicated `formatSlug` function from 3 collections (Courses, Chapters, Lessons) into a shared utility that properly supports Hebrew characters, leveraging the existing robust implementation in Exercises collection.

## Requirements

### FR-1: Create Shared Utility
- Extract `formatSlug` function from Exercises collection into a shared utility at `src/server/payload/fields/formatSlug.ts`
- The shared utility must use the `slugify` library with Hebrew locale support (`locale: 'he'`)
- Include strict mode and fallback behavior for edge cases

### FR-2: Update Courses Collection
- Remove inline `formatSlug` function from `src/server/payload/collections/Courses.ts`
- Import and use the shared utility for slug generation

### FR-3: Update Chapters Collection
- Remove inline `formatSlug` function from `src/server/payload/collections/Chapters.ts`
- Import and use the shared utility for slug generation

### FR-4: Update Lessons Collection
- Remove inline `formatSlug` function from `src/server/payload/collections/Lessons.ts`
- Import and use the shared utility for slug generation

### FR-5: Maintain Exercises Collection
- Either update Exercises to use the shared utility OR keep its own implementation (TBD - requires decision)

## Current Behavior

The inline versions use `[^\w-]+` regex which strips Hebrew characters entirely, producing empty or broken slugs for Hebrew titles:

```typescript
const formatSlug = (val: string): string =>
  val.replace(/ /g, '-').replace(/[^\w-]+/g, '').toLowerCase()
```

## Expected Behavior

Hebrew titles should generate valid, URL-safe slugs using the `slugify` library with Hebrew locale support:

```typescript
import { slugify } from '@/lib/slugify'

export const formatSlug = (val: string): string => {
  if (!val) return ''
  return slugify(val, { locale: 'he', strict: true }) || val.toLowerCase().replace(/\s+/g, '-')
}
```

## Acceptance Criteria

- [ ] Shared utility created at `src/server/payload/fields/formatSlug.ts`
- [ ] Courses.ts imports and uses shared formatSlug
- [ ] Chapters.ts imports and uses shared formatSlug
- [ ] Lessons.ts imports and uses shared formatSlug
- [ ] Hebrew titles generate valid slugs (e.g., "שלום עולם" → "shlom-olam")
- [ ] Existing English slugs continue to work correctly
- [ ] No breaking changes to existing URLs
