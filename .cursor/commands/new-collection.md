---
name: Create New Collection
description: Generate a new Payload collection with best practices
---

Create a new collection following project conventions:

1. Create file: `src/server/payload/collections/<Name>.ts`
2. Use this template:

```typescript
import type { CollectionConfig } from 'payload'
import { anyone } from '@/server/payload/access/anyone'
import { authenticated } from '@/server/payload/access/authenticated'

export const <Name>: CollectionConfig = {
  slug: '<slug>',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
  ],
}
```

3. Add to `src/payload.config.ts` collections array
4. Run `pnpm generate:types`
