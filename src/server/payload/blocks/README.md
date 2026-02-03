# Payload CMS Blocks

**@domain** content
**@fileType** block-config
**@ai-summary** Lexical editor blocks for rich content: Archive, Banner, Code, Form, Media, etc.

---

## Block Registry

| Block            | Path                   | Purpose                   | Frontend Component                                         |
| ---------------- | ---------------------- | ------------------------- | ---------------------------------------------------------- |
| **Archive**      | `blocks/ArchiveBlock/` | Post/archive list display | [`ArchiveBlock/Component.tsx`](ArchiveBlock/Component.tsx) |
| **Banner**       | `blocks/Banner/`       | Hero banner section       | [`Banner/Component.tsx`](Banner/Component.tsx)             |
| **CallToAction** | `blocks/CallToAction/` | CTA section with button   | [`CallToAction/Component.tsx`](CallToAction/Component.tsx) |
| **Code**         | `blocks/Code/`         | Syntax-highlighted code   | [`Code/Component.tsx`](Code/Component.tsx)                 |
| **Content**      | `blocks/Content/`      | Rich text content         | [`Content/Component.tsx`](Content/Component.tsx)           |
| **Form**         | `blocks/Form/`         | Contact form builder      | [`Form/Component.tsx`](Form/Component.tsx)                 |
| **HtmlBlock**    | `blocks/HtmlBlock/`    | Raw HTML injection        | [`HtmlBlock/Component.tsx`](HtmlBlock/Component.tsx)       |
| **MediaBlock**   | `blocks/MediaBlock/`   | Media embed               | [`MediaBlock/Component.tsx`](MediaBlock/Component.tsx)     |
| **RelatedPosts** | `blocks/RelatedPosts/` | Related content list      | [`RelatedPosts/Component.tsx`](RelatedPosts/Component.tsx) |

---

## Structure

```
blocks/
├── RenderBlocks.tsx              # Block renderer (maps types to components)
├── ArchiveBlock/
│   ├── Component.tsx             # Archive list UI
│   └── config.ts                 # Block schema
├── Banner/
│   ├── Component.tsx
│   └── config.ts
├── CallToAction/
│   ├── Component.tsx
│   └── config.ts
├── Code/
│   ├── Component.client.tsx      # Client component
│   ├── Component.tsx             # Server wrapper
│   ├── config.ts
│   └── CopyButton.tsx
├── Content/
│   ├── Component.tsx
│   └── config.ts
├── Form/
│   ├── Component.tsx
│   ├── config.ts
│   ├── fields.tsx                # Form field components
│   ├── Checkbox/
│   ├── Country/
│   ├── Email/
│   ├── Error/
│   ├── Message/
│   ├── Number/
│   ├── Select/
│   ├── State/
│   ├── Text/
│   ├── Textarea/
│   └── Width/
├── HtmlBlock/
│   ├── Component.tsx
│   └── config.ts
├── MediaBlock/
│   ├── Component.tsx
│   └── config.ts
└── RelatedPosts/
    ├── Component.tsx
    └── config.ts
```

---

## Block Configuration Pattern

```typescript
// blocks/Banner/config.ts
import type { Block } from 'payload'

export const BannerBlock: Block = {
  slug: 'banner',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'subtitle', type: 'textarea' },
    { name: 'backgroundImage', type: 'upload', relationTo: 'media' },
    { name: 'alignment', type: 'select', options: ['left', 'center', 'right'] },
  ],
}
```

## Usage in Collections

```typescript
// collections/Pages/index.ts
import { BannerBlock } from '@/server/payload/blocks/Banner/config'
import { ContentBlock } from '@/server/payload/blocks/Content/config'

export const Pages: CollectionConfig = {
  slug: 'pages',
  fields: [
    {
      name: 'content',
      type: 'blocks',
      blocks: [BannerBlock, ContentBlock],
    },
  ],
}
```

---

## Rendering Blocks

**File:** [`RenderBlocks.tsx`](RenderBlocks.tsx)

```typescript
import { RenderBlocks } from '@/server/payload/blocks/RenderBlocks'

// In a page component
const blocks = await getPageBlocks(slug)

return <RenderBlocks blocks={blocks} />
```

---

## Agent Guardrails

### Must

- Use `RenderBlocks` component for rendering block arrays (not manual mapping)
- Import blocks from `@/server/payload/blocks/` paths
- Define blocks with `type Block = { slug: string, fields: Field[] }` pattern
- Include server components for blocks that need SSR

### Must Not

- Hardcode block configs inline in collections
- Skip block imports in collections (causes hydration mismatches)
- Mix client and server block components incorrectly
- Use `blocks` field type without registering blocks in Payload config

### Should

- Follow `Block/config.ts` naming convention
- Use consistent field naming (camelCase for internal, localized for user-facing)
- Export both component and config from block directories
- Add TypeScript types for block-specific data

---

## Related Documentation

- [`docs/block-rendering/README.md`](../../../../docs/block-rendering/README.md) - Block rendering patterns
- [`AGENTS.md`](../../../../AGENTS.md) - Complete Payload patterns
- [`src/server/payload/collections/README.md`](../collections/README.md) - Collection configurations
