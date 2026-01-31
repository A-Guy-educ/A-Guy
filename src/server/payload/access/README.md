# Access Control Functions

**Purpose**: Reusable access control functions for Payload CMS collections.

## Quick Reference (~200 tokens)

```typescript
import { anyone } from '@/server/payload/access/anyone'
import { authenticated } from '@/server/payload/access/authenticated'
import { adminOnly } from '@/server/payload/access/adminOnly'
import { adminOrSelf } from '@/server/payload/access/adminOrSelf'
```

---

## Available Functions

| Function | Returns | Use Case |
|----------|---------|----------|
| `anyone` | `AccessResult` | Public read access |
| `authenticated` | `AccessResult` | Authenticated users only |
| `adminOnly` | `AccessResult` | Admin role required |
| `adminOrSelf` | `AccessResult` | Admin or record owner |
| `authenticatedOrPublished` | `AccessResult` | Public + authenticated |
| `authenticatedOrOwner` | `AccessResult` | Owner-based access |
| `configAdminOnly` | `AccessResult` | Config admin only |

---

## Usage in Collections

```typescript
import { CollectionConfig } from 'payload'
import { anyone } from '@/server/payload/access/anyone'
import { authenticated } from '@/server/payload/access/authenticated'
import { adminOnly } from '@/server/payload/access/adminOnly'

export const MyCollection: CollectionConfig = {
  slug: 'my-collection',
  access: {
    read: anyone,              // Public read
    create: authenticated,     // Authenticated create
    update: authenticated,     // Authenticated update
    delete: adminOnly,         // Admin only delete
  },
  // ...
}
```

---

## Related Documentation

- Collections: [`../collections/README.md`](collections/README.md)
- Full guide: [`docs/access-control/README.md`](docs/access-control/README.md)
