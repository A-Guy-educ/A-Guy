# Payload Globals

**Purpose**: Global configurations accessible across the application.

## Available Globals

| Global | Purpose | Key Fields |
|--------|---------|------------|
| `Header` | Navigation and branding | `navLinks`, `logo`, `actions` |
| `Footer` | Footer content | `copyright`, `links`, `social` |
| `Settings` | Site-wide settings | `siteName`, `analytics`, `features` |

---

## Usage Example

```typescript
import { Header } from '@/server/payload/globals/Header'
import { Footer } from '@/server/payload/globals/Footer'

// Access in components
const header = await req.payload.findGlobal({
  slug: 'header',
})
```

---

## Related Documentation

- Collections: [`../collections/README.md`](collections/README.md)
- Config: [`payload.config.ts`](../../payload.config.ts)
