# Payload Custom Fields

**Purpose**: Reusable field definitions for collections.

## Quick Reference (~150 tokens)

```typescript
import { createdByField } from '@/server/payload/fields/createdBy'
import { defaultLexical } from '@/server/payload/fields/defaultLexical'
import { linkField } from '@/server/payload/fields/link'
import { tenantField } from '@/server/payload/fields/tenant'
```

---

## Available Fields

| Field | Type | Purpose |
|-------|------|---------|
| `createdByField` | Relationship | Track creator |
| `defaultLexical` | RichText | Standard editor |
| `linkField` | Group | Link with label/URL |
| `linkGroup` | Array | Multiple links |
| `tenantField` | Relationship | Multi-tenant |

---

## Usage

```typescript
import { CollectionConfig } from 'payload'
import { createdByField } from '@/server/payload/fields/createdBy'
import { defaultLexical } from '@/server/payload/fields/defaultLexical'

export const Posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    createdByField,
    {
      name: 'content',
      type: 'richText',
      editor: defaultLexical,
    },
  ],
}
```

---

## Related Documentation

- Collections: [`../collections/README.md`](collections/README.md)
- Blocks: [`../blocks/README.md`](blocks/README.md)
