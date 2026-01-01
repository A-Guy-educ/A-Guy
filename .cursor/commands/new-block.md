---
name: Create New Block
description: Generate a new layout builder block
---

Create a new block in `src/blocks/<Name>/`:

1. Create `config.ts`:
```typescript
import type { Block } from 'payload'

export const <Name>Block: Block = {
  slug: '<slug>',
  interfaceName: '<Name>Block',
  fields: [
    // Add fields
  ],
}
```

2. Create `Component.tsx`:
```typescript
import React from 'react'
import type { <Name>Block as <Name>BlockType } from '@/payload-types'

export const <Name>Block: React.FC<<Name>BlockType> = (props) => {
  return <div>{/* Component content */}</div>
}
```

3. Add to `src/blocks/RenderBlocks.tsx`
4. Run `pnpm generate:types`

