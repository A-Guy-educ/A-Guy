# Design System Documentation

This document outlines the design system, UI components, and styling conventions for the A-Guy project.

## Table of Contents

- [Overview](#overview)
- [Migration Philosophy](#migration-philosophy)
- [Design Principles](#design-principles)
- [Design Tokens](#design-tokens)
- [Color System](#color-system)
- [Typography](#typography)
- [Spacing & Layout](#spacing--layout)
- [Shadows & Elevation](#shadows--elevation)
- [Z-Index Scale](#z-index-scale)
- [Components](#components)
- [Dark Mode](#dark-mode)
- [Accessibility](#accessibility)
- [Styling Guidelines](#styling-guidelines)
- [Migration Checklist](#migration-checklist)
- [Best Practices](#best-practices)

## Overview

The A-Guy design system is built on:

- **Framework**: TailwindCSS with custom configuration
- **Component Library**: shadcn/ui (built on Radix UI primitives)
- **Design Tokens**: Semantic tokens in `tailwind.tokens.mjs`
- **Icons**: lucide-react
- **Fonts**: Geist Sans and Geist Mono
- **Styling Approach**: 100% Tailwind CSS (no SCSS/CSS modules)
- **Dark Mode**: Theme-aware with automatic transitions
- **Documentation**: Storybook for visual component catalog

## Migration Philosophy

The project is migrating from a mixed styling approach (Tailwind + SCSS) to a unified design system:

### Goals

1. **100% Tailwind**: All styling done with Tailwind utilities and design tokens
2. **Zero SCSS**: Eliminate all `.scss` files from frontend components
3. **No Payload Imports**: Never use `@payloadcms/ui/scss` in frontend components
4. **Consistent Patterns**: Unified approach across all components
5. **Visual Documentation**: Comprehensive Storybook stories

### Rules

✅ **ALWAYS use:**

- Tailwind utility classes
- Design tokens from `tailwind.tokens.mjs`
- CSS variables defined in `globals.css`
- shadcn/ui components as primitives
- Class Variance Authority (CVA) for component variants

❌ **NEVER use:**

- SCSS modules
- CSS modules
- `@import '~@payloadcms/ui/scss'` in frontend
- Inline styles
- Arbitrary values (except when design tokens don't cover the use case)
- CSS-in-JS libraries

## Design Principles

### 1. Consistency

All components follow a consistent design language using:

- Shared color tokens
- Standardized spacing scale
- Unified border radius system
- Consistent focus states

### 2. Accessibility First

- All components are built on Radix UI primitives (ARIA-compliant)
- Keyboard navigation support
- Focus management
- Screen reader compatibility

### 3. Performance

- CSS-in-JS avoided in favor of Tailwind utilities
- Minimal runtime overhead
- Optimized for production builds

### 4. Developer Experience

- Type-safe component props
- Composable variants using `class-variance-authority`
- Clear naming conventions
- Well-documented usage patterns
- Comprehensive Storybook documentation

## Design Tokens

Design tokens are defined in [`tailwind.tokens.mjs`](./tailwind.tokens.mjs) and provide semantic, reusable values for spacing, typography, shadows, and more.

### Spacing Tokens

```tsx
// Section spacing (vertical rhythm)
<div className="py-section-md">   {/* 4rem / 64px */}
<div className="py-section-lg">   {/* 6rem / 96px */}

// Card padding
<div className="p-card-padding">   {/* 1.5rem / 24px */}
<div className="p-card-padding-lg"> {/* 2rem / 32px */}

// Content gaps
<div className="gap-content-gap">   {/* 1.5rem / 24px */}
<div className="space-y-content-gap-lg"> {/* 2rem / 32px */}
```

### Typography Tokens

```tsx
// Display sizes (hero sections)
<h1 className="text-display-2xl">Hero Heading</h1>
<h1 className="text-display-xl">Large Heading</h1>

// Heading sizes
<h2 className="text-heading-xl">Section Heading</h2>
<h3 className="text-heading-lg">Subsection</h3>

// Body text
<p className="text-body-md">Default body text</p>
<p className="text-body-lg">Large body text</p>
<p className="text-body-sm">Small body text</p>

// Code
<code className="text-code-md">Code snippet</code>
```

### Shadow Tokens

```tsx
// Elevation levels
<div className="shadow-elevation-1"> {/* Subtle */}
<div className="shadow-elevation-2"> {/* Light */}
<div className="shadow-elevation-3"> {/* Medium */}
<div className="shadow-elevation-4"> {/* Strong */}

// Component shadows
<div className="shadow-card">       {/* Card shadow */}
<div className="shadow-card-hover"> {/* Card hover state */}
<div className="shadow-modal">      {/* Modal shadow */}
<div className="shadow-dropdown">   {/* Dropdown shadow */}
```

### Z-Index Tokens

```tsx
<div className="z-dropdown">        {/* 1000 */}
<div className="z-sticky">          {/* 1100 */}
<div className="z-fixed">           {/* 1200 */}
<div className="z-modal-backdrop">  {/* 1300 */}
<div className="z-modal">           {/* 1400 */}
<div className="z-popover">         {/* 1500 */}
<div className="z-tooltip">         {/* 1600 */}
```

### Transition Duration Tokens

```tsx
<div className="duration-fast">    {/* 100ms */}
<div className="duration-normal">  {/* 200ms */}
<div className="duration-slow">    {/* 300ms */}
<div className="duration-slower">  {/* 500ms */}
```

### Opacity Tokens

```tsx
<div className="opacity-disabled"> {/* 0.5 */}
<div className="opacity-hover">    {/* 0.8 */}
<div className="opacity-muted">    {/* 0.6 */}
<div className="opacity-subtle">   {/* 0.4 */}
```

## Color System

### Color Tokens

Colors are defined using HSL CSS variables for easy theming:

#### Light Mode

```css
--background: 220 40% 97% /* Soft blue-gray background */ --foreground: 222.2 84% 4.9%
  /* Near-black text */ --primary: 220 40% 97% /* Light blue for primary actions */ --secondary: 251
  91% 95% /* Soft purple tint */ --accent: 271 91% 65% /* Vivid purple for highlights */
  --muted: 210 40% 96.1% /* Muted backgrounds */ --border: 240 6% 80% /* Subtle borders */;
```

#### Dark Mode

```css
--background: 220 40% 8% /* Deep blue-black */ --foreground: 210 40% 98% /* Off-white text */
  --primary: 220 40% 12% /* Dark blue surfaces */ --secondary: 261 73% 23% /* Deep violet surface */
  --accent: 271 91% 65% /* Vivid purple (same as light) */ --muted: 217.2 32.6% 17.5%
  /* Muted dark backgrounds */ --border: 0 0% 15% / 0.8 /* Subtle dark borders */;
```

### Semantic Colors

```css
--success: 196 52% 74% /* Light mode success (teal) */ --warning: 34 89% 85%
  /* Light mode warning (orange) */ --error: 10 100% 86% /* Light mode error (red) */
  --destructive: 0 84.2% 60.2% /* Destructive actions */;
```

### Usage in Components

```tsx
// Using Tailwind classes with CSS variables
<div className="bg-background text-foreground border border-border">
  <button className="bg-accent text-accent-foreground">Click me</button>
  <div className="bg-success">Success message</div>
</div>
```

## Typography

### Font Families

**Geist Sans** (Primary)

- Used for all body text and UI elements
- Variable: `--font-geist-sans`
- Class: `font-sans`

**Geist Mono** (Code/Monospace)

- Used for code blocks and monospaced content
- Variable: `--font-geist-mono`
- Class: `font-mono`

### Type Scale

Configured via `@tailwindcss/typography` plugin:

```tsx
// Heading sizes (responsive)
<h1 className="text-[2.5rem] md:text-[3.5rem]">Main Heading</h1>
<h2 className="text-[1.25rem] md:text-[1.5rem] font-semibold">Subheading</h2>

// Body text
<p className="text-base">Regular body text</p>
<p className="text-sm">Small text</p>
<p className="text-xs">Extra small text</p>
```

### Font Weights

```tsx
<span className="font-normal">Regular (400)</span>
<span className="font-medium">Medium (500)</span>
<span className="font-semibold">Semibold (600)</span>
```

### Rich Text Styling

Use the `prose` class from `@tailwindcss/typography` for rich content:

```tsx
<div className="prose prose-slate dark:prose-invert">{/* Your rich text content */}</div>
```

## Spacing & Layout

### Container

Responsive container with consistent padding:

```tsx
<div className="container">{/* Content centered with responsive padding */}</div>
```

Container breakpoints:

- `sm`: 40rem (640px) - padding: 1rem
- `md`: 48rem (768px) - padding: 2rem
- `lg`: 64rem (1024px) - padding: 2rem
- `xl`: 80rem (1280px) - padding: 2rem
- `2xl`: 86rem (1376px) - padding: 2rem

### Spacing Scale

Follow Tailwind's default spacing scale:

```tsx
// Margins and padding
<div className="p-4 m-2"> {/* 1rem padding, 0.5rem margin */}
<div className="space-y-4"> {/* 1rem vertical spacing between children */}
<div className="gap-6"> {/* 1.5rem gap in flex/grid */}
```

Common spacing values:

- `0.5` = 0.125rem (2px)
- `1` = 0.25rem (4px)
- `2` = 0.5rem (8px)
- `4` = 1rem (16px)
- `6` = 1.5rem (24px)
- `8` = 2rem (32px)

### Border Radius

Configured via CSS variable `--radius`:

```tsx
<div className="rounded-sm"> {/* calc(var(--radius) - 4px) */}
<div className="rounded-md"> {/* calc(var(--radius) - 2px) */}
<div className="rounded-lg"> {/* var(--radius) = 0.75rem */}
<div className="rounded-xl"> {/* calc(var(--radius) + 4px) */}
<div className="rounded-2xl"> {/* calc(var(--radius) + 8px) */}
```

## Shadows & Elevation

The shadow system provides consistent depth and elevation across components.

### Using Shadow Tokens

```tsx
// Subtle elevation
<div className="shadow-elevation-1">Barely lifted</div>

// Card components
<div className="shadow-card hover:shadow-card-hover transition-shadow">
  Interactive card with hover effect
</div>

// Modals and overlays
<div className="shadow-modal">Modal content</div>

// Dropdowns
<div className="shadow-dropdown">Dropdown menu</div>
```

### CSS Variables (for complex cases)

For cases where you need to use CSS variables:

```tsx
// Light mode card shadow
<div className="shadow-[var(--shadow-card)]">

// Dark mode adapts automatically via CSS variables
```

### Custom Shadows

Prefer design tokens, but if you need a custom shadow:

```tsx
// ✅ ACCEPTABLE: One-off custom shadow
<div className="shadow-[0_4px_20px_0_rgb(0_0_0_/_0.1)]">

// ❌ BAD: Reusing the same custom shadow multiple times
// Instead, add to tailwind.tokens.mjs
```

## Z-Index Scale

Consistent stacking order prevents z-index conflicts.

### Using Z-Index Tokens

```tsx
// Dropdown menus
<div className="z-dropdown">Menu</div>

// Sticky headers
<header className="sticky top-0 z-sticky">Header</header>

// Fixed elements
<aside className="fixed z-fixed">Sidebar</aside>

// Modal backdrop
<div className="fixed inset-0 z-modal-backdrop bg-black/50" />

// Modal content
<div className="fixed inset-0 z-modal">Modal</div>

// Popovers
<div className="z-popover">Popover</div>

// Tooltips (highest)
<div className="z-tooltip">Tooltip</div>
```

### Z-Index Hierarchy

```
Base Layer:      0
Dropdown:        1000
Sticky:          1100
Fixed:           1200
Modal Backdrop:  1300
Modal:           1400
Popover:         1500
Tooltip:         1600
Toast:           1700 (highest)
```

### Anti-Pattern

```tsx
// ❌ BAD: Arbitrary z-index values
<div className="z-[9999]">
<div className="z-[999999]">

// ✅ GOOD: Use semantic tokens
<div className="z-modal">
```

## Components

### Available UI Components

Located in `src/components/ui/`:

- **Button** (`button.tsx`)
- **Card** (`card.tsx`)
- **Checkbox** (`checkbox.tsx`)
- **Command** (`command.tsx`) - Command palette
- **Input** (`input.tsx`)
- **Label** (`label.tsx`)
- **Pagination** (`pagination.tsx`)
- **Select** (`select.tsx`)
- **Textarea** (`textarea.tsx`)
- **Toaster** (`toaster.tsx`) - Toast notifications

### Component Usage Examples

#### Button

```tsx
import { Button } from '@/components/ui/button'

// Variants
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">🔍</Button>

// As child (polymorphic)
<Button asChild>
  <a href="/somewhere">Link Button</a>
</Button>
```

**Button Variants:**

- `default`: Primary background with hover effect
- `secondary`: Secondary background
- `destructive`: Red/destructive background
- `outline`: Border with transparent background
- `ghost`: Transparent with hover effect
- `link`: Text link style with underline on hover

#### Card

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
;<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Input & Form Fields

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
  />
</div>

<div className="space-y-2">
  <Label htmlFor="message">Message</Label>
  <Textarea
    id="message"
    placeholder="Enter your message"
  />
</div>
```

#### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
;<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

#### Checkbox

```tsx
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
;<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>
```

#### Toast Notifications

```tsx
import { toast } from 'sonner'

// Success
toast.success('Successfully saved!')

// Error
toast.error('Something went wrong')

// Info
toast('This is a notification')

// With description
toast.success('Account created', {
  description: 'Your account has been created successfully',
})
```

Add the Toaster component to your root layout:

```tsx
import { Toaster } from '@/components/ui/toaster'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

#### Command Palette

```tsx
import { CommandPalette } from '@/components/CommandPalette'

// Add to your layout
;<CommandPalette />

// Trigger with Cmd+K or Ctrl+K
```

### Custom Application Components

Located in `src/components/`:

- **AdminBar** - Admin panel overlay
- **Card** - Custom card wrapper
- **CollectionArchive** - Archive listing
- **Link** - Next.js Link wrapper
- **Logo** - Application logo
- **Media** - Image/video components with optimization
- **Pagination** - Custom pagination
- **RichText** - Lexical rich text renderer

## Dark Mode

### Implementation

Dark mode uses a data attribute strategy:

```tsx
// In tailwind.config.mjs
darkMode: ['selector', '[data-theme="dark"]']
```

Theme is automatically applied based on user preference or manual selection.

### Theme Transitions

Smooth transitions are enabled for theme changes:

```css
/* In globals.css */
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```

### Preventing Flash

```css
/* Prevent flash of unstyled content */
html {
  opacity: 0;
}

html[data-theme='dark'],
html[data-theme='light'] {
  opacity: initial;
}
```

### Dark Mode Classes

```tsx
// Use dark: prefix for dark mode styles
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">Content adapts to theme</div>
```

## Accessibility

### Focus States

All interactive elements have visible focus rings:

```tsx
// Automatic focus ring using ring-offset-background
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
  Accessible Button
</button>
```

### Keyboard Navigation

- All components support keyboard navigation
- Tab order is logical and intuitive
- Focus traps in modals and dialogs
- Escape to close overlays

### Screen Reader Support

- Semantic HTML elements
- ARIA labels and roles (via Radix UI)
- Hidden elements for screen readers only
- Proper heading hierarchy

### Color Contrast

All color combinations meet WCAG AA standards:

- Text on backgrounds: minimum 4.5:1 contrast ratio
- Large text: minimum 3:1 contrast ratio
- Interactive elements have clear hover/focus states

## Styling Guidelines

### When to Use Tailwind

✅ **ALWAYS use Tailwind (100% goal):**

- Layout (flex, grid, spacing)
- Colors, typography, borders
- Responsive design
- State variants (hover, focus, active, disabled)
- Animations (use Tailwind animate or create custom utilities)
- SVG styling (use CSS variables + Tailwind classes or data attributes)

### How to Handle Complex Cases

#### Complex Animations

```tsx
// Option 1: Use Tailwind animate utilities
<div className="animate-spin">Loading...</div>
<div className="animate-pulse">Pulsing</div>

// Option 2: Create custom animation in tailwind.config.mjs
// Add to keyframes and animation sections
```

#### SVG Styling

```tsx
// Option 1: Tailwind classes for containers
<svg className="w-24 h-24 text-primary">
  <circle className="fill-current" />
</svg>

// Option 2: CSS variables for complex SVG
// Define in globals.css:
// --svg-stroke: hsl(var(--primary));
// --svg-fill: hsl(var(--accent));
```

#### Third-Party Component Overrides

```tsx
// Use CSS variables + Tailwind
<div className="[&_.external-class]:bg-primary [&_.external-class]:text-white">
  <ExternalComponent />
</div>
```

### Class Naming Pattern

Follow this order for consistent, readable classes:

```tsx
<div
  className={cn(
    // 1. Layout
    'flex items-center justify-between',

    // 2. Spacing
    'p-card-padding gap-content-gap',

    // 3. Visual (background, border, etc)
    'bg-card border border-border rounded-lg',

    // 4. Typography
    'text-body-md font-medium',

    // 5. Design tokens (shadows, etc)
    'shadow-card',

    // 6. State variants
    'hover:shadow-card-hover hover:bg-accent/5',
    'focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:opacity-disabled',

    // 7. Responsive
    'md:flex-row md:p-card-padding-lg',

    // 8. Conditional classes
    isActive && 'bg-primary text-primary-foreground',

    // 9. External className prop (last for override)
    className,
  )}
/>
```

### Using Design Tokens

```tsx
// ✅ GOOD: Use design tokens
<div className="py-section-md shadow-card z-modal text-heading-xl">

// ❌ BAD: Arbitrary values
<div className="py-[80px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] z-[9999] text-[24px]">

// ✅ ACCEPTABLE: Arbitrary when tokens don't cover it
<div className="max-w-[42rem]"> {/* Specific content width */}
```

### Component Composition with cn()

Use the `cn()` utility for merging classes:

```tsx
import { cn } from '@/utilities/ui'

interface CardProps {
  variant?: 'default' | 'elevated'
  className?: string
}

export function Card({ variant = 'default', className }: CardProps) {
  return (
    <div
      className={cn(
        'p-card-padding rounded-lg border border-border',
        variant === 'elevated' && 'shadow-elevation-3',
        className,
      )}
    />
  )
}
```

### Using CVA for Variants

For components with multiple variants, use Class Variance Authority:

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utilities/ui'

const buttonVariants = cva(
  // Base classes
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-transparent hover:bg-accent',
      },
      size: {
        sm: 'h-9 px-3 text-body-sm',
        md: 'h-10 px-4 text-body-md',
        lg: 'h-11 px-8 text-body-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
```

## Migration Checklist

Use this checklist when migrating a component from SCSS to Tailwind:

### Before Migration

- [ ] Take screenshot of component (all states)
- [ ] Document all variants and states
- [ ] Identify complex styles that may need special handling
- [ ] Check for Payload SCSS imports (must remove)
- [ ] Review SCSS file for patterns to extract

### During Migration

- [ ] Start with layout (flex, grid, spacing)
- [ ] Add spacing with design tokens
- [ ] Add visual styles (colors, borders, shadows)
- [ ] Add typography styles
- [ ] Add state variants (hover, focus, active, disabled)
- [ ] Add responsive breakpoints
- [ ] Test all interactive states
- [ ] Test dark mode

### After Migration

- [ ] Delete SCSS file
- [ ] Update all imports
- [ ] Test all variants and states
- [ ] Compare screenshots (before/after)
- [ ] Verify dark mode works
- [ ] Check accessibility (keyboard nav, screen readers)
- [ ] Update or create Storybook story
- [ ] Code review

## Best Practices

### Component Composition

Use the `cn` utility for merging classes:

```tsx
import { cn } from '@/utilities/ui'

<div className={cn(
  'base-classes',
  'more-classes',
  condition && 'conditional-classes',
  className // User-provided classes override defaults
)}>
```

### Variant Pattern

Use `class-variance-authority` for variant-based components:

```tsx
import { cva, type VariantProps } from 'class-variance-authority'

const variants = cva('base-classes', {
  variants: {
    variant: {
      default: 'default-classes',
      secondary: 'secondary-classes',
    },
    size: {
      sm: 'small-classes',
      lg: 'large-classes',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'sm',
  },
})

type Props = VariantProps<typeof variants>
```

### Responsive Design

Use Tailwind's responsive prefixes:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>

<h1 className="text-2xl md:text-4xl lg:text-5xl">
  {/* Responsive typography */}
</h1>
```

### Performance Optimization

**Avoid:**

```tsx
// ❌ Don't use arbitrary values unless necessary
<div className="p-[13px]">

// ❌ Don't duplicate styles
<div className="bg-red-500 hover:bg-red-500">
```

**Prefer:**

```tsx
// ✅ Use design system tokens
<div className="p-4">

// ✅ Use CSS variables
<div className="bg-accent hover:bg-accent/90">
```

### Adding New Components

When adding shadcn/ui components:

```bash
# Use npx to add components
npx shadcn@latest add <component-name>

# Examples
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tabs
```

Components will be automatically added to `src/components/ui/` with proper configuration.

### Customization Guidelines

**DO:**

- ✅ Use CSS variables for colors
- ✅ Extend existing variants
- ✅ Follow existing naming patterns
- ✅ Maintain accessibility features
- ✅ Test in both light and dark modes

**DON'T:**

- ❌ Modify Radix UI primitives directly
- ❌ Remove accessibility features
- ❌ Use inline styles
- ❌ Bypass the design system tokens
- ❌ Add global CSS without team approval
- ❌ Import Payload SCSS in frontend components
- ❌ Create new SCSS or CSS module files

## Utility Classes

### Custom Utilities

Located in `globals.css`:

```css
/* Hide scrollbar */
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Prevent transitions on load */
.no-transition {
  transition: none !important;
}
```

### Smooth Scrolling

```css
html {
  scroll-behavior: smooth;
}
```

### Backdrop Blur

```css
@supports (backdrop-filter: blur(10px)) {
  .backdrop-blur-lg {
    backdrop-filter: blur(16px);
  }
}
```

## Resources

- **TailwindCSS Docs**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **shadcn/ui**: [https://ui.shadcn.com](https://ui.shadcn.com)
- **Radix UI**: [https://www.radix-ui.com](https://www.radix-ui.com)
- **lucide-react Icons**: [https://lucide.dev](https://lucide.dev)
- **Class Variance Authority**: [https://cva.style](https://cva.style)
- **Sonner (Toast)**: [https://sonner.emilkowal.ski](https://sonner.emilkowal.ski)

## Getting Help

If you need to:

- **Add a new component**: Check [shadcn/ui](https://ui.shadcn.com) first
- **Customize colors**: Modify CSS variables in `globals.css`
- **Extend Tailwind**: Update `tailwind.config.mjs`
- **Report design inconsistencies**: Create an issue with screenshots

For questions about design decisions or component usage, refer to [PROJECT-TOOLING.md](./PROJECT-TOOLING.md) or consult with the team.
