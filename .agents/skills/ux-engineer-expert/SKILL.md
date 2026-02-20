# UX Engineer Expert Skill

**Description**: Expert UI/UX engineering with micro-component architecture, design systems, Tailwind CSS, and shadcn/ui. Delivers production-ready, accessible, and maintainable React components.

**Category**: Development

**Tags**: ui, ux, react, components, design-system, tailwind, shadcn, accessibility, micro-components

---

## Core Principles

1. **Micro-Component Architecture**: Single responsibility, composability, isolation, testability
2. **Design System First**: Consistency through tokens, systematic variants, comprehensive documentation
3. **Accessibility by Default**: Semantic HTML, ARIA, keyboard navigation, screen readers
4. **Performance Optimization**: Code splitting, memoization, minimal re-renders

---

## Component Structure

```
src/components/
├── ui/                    # shadcn/ui base components
├── design-system/         # Custom design system
│   ├── primitives/        # Atomic (Icon, Text, Spacer, Container)
│   ├── patterns/          # Composite (FormField, DataTable, Modal)
│   └── layouts/           # Layout (PageLayout, SidebarLayout, GridLayout)
└── features/              # Feature-specific components
```

---

## Component Template (ALWAYS USE THIS)

```typescript
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 1. Define variants using CVA
const componentVariants = cva(
  'base-classes', // Always include focus-visible, transitions, disabled states
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input hover:bg-accent',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8 text-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

// 2. Props interface with proper TypeScript
export interface ComponentNameProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  label?: string
  isDisabled?: boolean
  onAction?: () => void
}

// 3. Component with forwardRef for DOM access
export const ComponentName = React.forwardRef<HTMLDivElement, ComponentNameProps>(
  ({ className, variant, size, label, isDisabled = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(componentVariants({ variant, size, className }))}
        aria-disabled={isDisabled}
        {...props}
      >
        {label && <span className="sr-only">{label}</span>}
        {children}
      </div>
    )
  }
)

ComponentName.displayName = 'ComponentName'
```

---

## Essential Patterns

### 1. Form Field with Validation

```typescript
export interface FormFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactElement
}

export const FormField = ({ id, label, error, hint, required, children }: FormFieldProps) => {
  const hasError = Boolean(error)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive" aria-label="required">*</span>}
      </Label>

      {React.cloneElement(children, {
        id,
        'aria-invalid': hasError,
        'aria-describedby': hasError ? `${id}-error` : hint ? `${id}-hint` : undefined,
      })}

      {hint && !hasError && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      )}

      {hasError && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">{error}</p>
      )}
    </div>
  )
}
```

### 2. Generic Data Table

```typescript
interface Column<T> {
  key: string
  header: string
  accessor: (item: T) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
}

export function DataTable<T>({ data, columns, keyExtractor, onRowClick, emptyMessage = 'No data' }: DataTableProps<T>) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col.key} style={{ width: col.width }} className={cn({ 'text-center': col.align === 'center', 'text-right': col.align === 'right' })}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map(item => (
              <TableRow key={keyExtractor(item)} onClick={() => onRowClick?.(item)} className={cn({ 'cursor-pointer hover:bg-muted/50': onRowClick })}>
                {columns.map(col => (
                  <TableCell key={col.key} className={cn({ 'text-center': col.align === 'center', 'text-right': col.align === 'right' })}>
                    {col.accessor(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 3. Page Layout System

```typescript
const maxWidthClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[90rem]',
  full: 'max-w-full',
}

export const PageLayout = ({ children, maxWidth = 'lg', padding = 'md' }) => (
  <div className={cn('mx-auto w-full', maxWidthClasses[maxWidth], padding === 'md' ? 'p-6' : padding === 'lg' ? 'p-8' : 'p-4')}>
    {children}
  </div>
)

export const PageHeader = ({ title, description, actions }) => (
  <div className="mb-8 flex items-start justify-between">
    <div className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-lg text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
)

export const PageSection = ({ title, description, children }) => (
  <section className="space-y-4">
    {(title || description) && (
      <div className="space-y-1">
        {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
    )}
    {children}
  </section>
)
```

---

## Critical Best Practices

### ✅ Composition Over Monoliths

```typescript
// ❌ Bad: Everything in one component
const UserCard = ({ user }) => (
  <div><img src={user.avatar} /><h2>{user.name}</h2><button>Follow</button></div>
)

// ✅ Good: Composed from reusable pieces
const UserCard = ({ user }) => (
  <Card>
    <CardHeader>
      <Avatar src={user.avatar} alt={user.name} />
      <UserInfo name={user.name} bio={user.bio} />
    </CardHeader>
    <CardFooter>
      <ActionButton>Follow</ActionButton>
    </CardFooter>
  </Card>
)
```

### ✅ Proper TypeScript Generics

```typescript
// For reusable components that work with any data type
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return <ul>{items.map(item => <li key={keyExtractor(item)}>{renderItem(item)}</li>)}</ul>
}
```

### ✅ Compound Components for Complex APIs

```typescript
// When a component has multiple related parts
const Select = ({ children, value, onChange }) => (
  <SelectContext.Provider value={{ value, onChange }}>
    {children}
  </SelectContext.Provider>
)

Select.Trigger = ({ children }) => <button>{children}</button>
Select.Content = ({ children }) => <div>{children}</div>
Select.Item = ({ value, children }) => {
  const { onChange } = useSelectContext()
  return <button onClick={() => onChange(value)}>{children}</button>
}

// Usage:
<Select value={x} onChange={setX}>
  <Select.Trigger>Choose</Select.Trigger>
  <Select.Content>
    <Select.Item value="1">Option 1</Select.Item>
  </Select.Content>
</Select>
```

---

## Performance Patterns

```typescript
// ✅ Memoize expensive computations
const sorted = React.useMemo(() => data.sort(compareFn), [data])

// ✅ Memoize stable components
const MemoizedItem = React.memo(({ item }) => <div>{item.name}</div>)

// ✅ Stable callbacks prevent child re-renders
const handleClick = React.useCallback(() => doSomething(id), [id])

// ✅ Lazy load heavy components
const Chart = React.lazy(() => import('./Chart'))
<Suspense fallback={<Skeleton />}><Chart /></Suspense>
```

---

## Accessibility Checklist (REQUIRED)

Every component must have:

- [ ] Semantic HTML (`<button>` not `<div onClick>`, `<nav>`, `<main>`, etc.)
- [ ] Proper ARIA attributes (`role`, `aria-label`, `aria-describedby`, `aria-invalid`)
- [ ] Keyboard navigation (Tab, Enter, Space, Escape, Arrow keys)
- [ ] Visible focus indicators (`focus-visible:ring-2`)
- [ ] Color contrast ≥ 4.5:1 (WCAG AA)
- [ ] Screen reader labels (use `sr-only` for icon-only buttons)
- [ ] Touch targets ≥ 44x44px
- [ ] Respects `prefers-reduced-motion`

---

## Component Development Checklist

Before marking component complete:

- [ ] TypeScript types are strict and complete
- [ ] All variants work correctly
- [ ] Fully accessible (see checklist above)
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Dark mode support
- [ ] Error states handled
- [ ] Loading states handled
- [ ] Empty states handled
- [ ] Performance optimized (no unnecessary re-renders)

---

## Common Mistakes to Avoid

### ❌ Missing forwardRef

```typescript
// ❌ Bad: Can't get ref to underlying DOM
export const Button = ({ children, ...props }) => <button {...props}>{children}</button>

// ✅ Good: Supports ref forwarding
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => <button ref={ref} {...props}>{props.children}</button>
)
```

### ❌ Hardcoded Styles Instead of Variants

```typescript
// ❌ Bad: Inline conditionals
<button className={isPrimary ? 'bg-blue-500' : 'bg-gray-500'}>

// ✅ Good: CVA variants
const buttonVariants = cva('...', {
  variants: { variant: { primary: 'bg-blue-500', secondary: 'bg-gray-500' }}
})
```

### ❌ Props Spreading Before className

```typescript
// ❌ Bad: className will be overridden
<div className={cn('my-styles', className)} {...props} />

// ✅ Good: Props first, then className
<div {...props} className={cn('my-styles', className)} />
```

---

## Design Tokens (Use Existing Project Tokens)

Reference the project's design system:

- Colors: Use `hsl(var(--primary))` pattern from globals.css
- Spacing: Use Tailwind's scale (4, 8, 12, 16, 24, 32, 48, 64px)
- Typography: Follow existing text-sm, text-base, text-lg hierarchy
- Shadows: Use Tailwind's shadow-sm, shadow, shadow-md, shadow-lg
- Radius: Use rounded-sm, rounded, rounded-md, rounded-lg

---

## Refactoring Policy

When modifying existing components:

### ✅ DO Refactor (when touching the component):

- Fix accessibility issues (missing ARIA, semantic HTML)
- Update to use design system tokens (replace hardcoded colors/spacing)
- Add missing variants using CVA pattern
- Fix forwardRef if missing
- Correct className ordering
- Add TypeScript types if missing

### ❌ DON'T Refactor (avoid scope creep):

- Unrelated components in the same file
- Components you're not modifying
- Surrounding code that works correctly
- "Nice to have" improvements beyond the task

### 🤔 ASK First (significant changes):

- Breaking component API changes
- Major structural refactors
- Moving components to new locations
- Changing component composition patterns

**Rule**: If you touch a component, bring it up to design system standards. Don't touch components outside your task scope.

---

## Workflow

1. **Plan API** - Props, variants, composition strategy
2. **Build primitive** - Start with smallest reusable unit
3. **Add accessibility** - Semantic HTML, ARIA, keyboard support
4. **Create variants** - Size, color, state variations via CVA
5. **Compose patterns** - Combine primitives into useful patterns
6. **Optimize performance** - Add memoization where needed
7. **Test & document** - Write tests, add Storybook stories

---

## Resources

- [shadcn/ui](https://ui.shadcn.com/) - Component examples
- [Radix UI](https://www.radix-ui.com/) - Accessible primitives
- [ARIA Practices](https://www.w3.org/WAI/ARIA/apg/) - Accessibility patterns
- [CVA](https://cva.style/) - Variant management

---

**Note**: For advanced patterns (error boundaries, compound components, discriminated unions, testing strategies), ask for specific guidance when needed.
