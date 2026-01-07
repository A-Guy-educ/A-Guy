---
name: add-ui-component
description: Add shadcn/ui component and optionally create custom wrapper
allowed-tools: Read, Write, Edit, Bash
---

# Add UI Component

Add shadcn/ui components and create custom wrappers following design system patterns.

## Workflow

### Step 1: Identify Component

Ask user which component to add from: https://ui.shadcn.com/docs/components

Common: button, input, label, dialog, dropdown-menu, card, table, toast, form

### Step 2: Add Component

```bash
npx shadcn@latest add <component-name>
```

Multiple components:

```bash
npx shadcn@latest add button input label
```

### Step 3: Verify

```bash
ls src/components/ui/<component-name>.tsx
```

### Step 4: Create Wrapper (Optional)

If custom wrapper needed, create in `src/components/design-system/`:

```typescript
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variants = cva('base-classes', {
  variants: {
    variant: { default: 'styles' },
    size: { md: 'styles' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export const Component = React.forwardRef<HTMLElement, Props>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn(variants({ className }))} {...props} />
  }
)
Component.displayName = 'Component'
```

### Step 5: Usage Example

```typescript
import { Button } from '@/components/ui/button'

<Button variant="default">Click me</Button>
```

## Success Criteria

- [ ] Component added to `src/components/ui/`
- [ ] Usage examples provided
- [ ] TypeScript correct
