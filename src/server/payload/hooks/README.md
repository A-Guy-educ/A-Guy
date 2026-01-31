# Hook Functions

**Purpose**: Reusable hook functions for collections and globals.

## Quick Reference (~200 tokens)

```typescript
// Collection hooks
import { populatePublishedAt } from '@/server/payload/hooks/populatePublishedAt'
import { revalidateRedirects } from '@/server/payload/hooks/revalidateRedirects'

// Config entries hooks
import { afterChangeHook } from '@/server/payload/hooks/configEntries/afterChange-hook'
import { beforeChangeHook } from '@/server/payload/hooks/configEntries/beforeChange-hook'
```

---

## Available Hooks

### Before Change

| Hook | Purpose |
|------|---------|
| `populatePublishedAt` | Auto-set publishedAt on publish |

### After Change

| Hook | Purpose |
|------|---------|
| `revalidateRedirects` | Revalidate redirects after change |

### Config Entries Hooks

| Hook | Purpose |
|------|---------|
| `afterChange-hook` | Post-save operations for config |
| `beforeChange-hook` | Pre-save validation for config |
| `afterRead-hook` | Transform config on read |

---

## Usage in Collections

```typescript
import { CollectionConfig } from 'payload'
import { populatePublishedAt } from '@/server/payload/hooks/populatePublishedAt'

export const Posts: CollectionConfig = {
  slug: 'posts',
  hooks: {
    beforeChange: [
      populatePublishedAt,  // Auto-set publishedAt
    ],
  },
}
```

---

## Related Documentation

- Collections: [`../collections/README.md`](collections/README.md)
- Full guide: [`AGENTS.md`](AGENTS.md) - Hooks section
