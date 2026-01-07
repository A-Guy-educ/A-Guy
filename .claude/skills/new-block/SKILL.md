---
name: new-block
description: Create a new Payload layout builder block with config and React component
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create New Layout Builder Block

This skill generates a new layout builder block for Payload CMS with proper configuration and React component following project conventions.

## What This Skill Does

1. Gathers block requirements from user
2. Reads existing block patterns for consistency
3. Generates block config file
4. Creates React component
5. Adds block to RenderBlocks component
6. Runs type and importmap generation
7. Validates no errors

## Workflow

### Step 1: Gather Requirements

Ask the user for:

- **Block name** (e.g., "Hero", "CallToAction", "ImageGrid")
- **Block slug** (auto-suggest kebab-case from name, e.g., "hero", "call-to-action", "image-grid")
- **Block purpose** (brief description for admin UI)
- **Fields needed**:
  - Field name, type, and whether required
  - Common types: text, textarea, richText, upload (images), select, checkbox
  - Group related fields together

**Common Block Patterns:**

- **Hero**: heading, subheading, CTA button, background image
- **Content**: rich text content, optional media
- **CTA**: heading, description, button text, button link
- **Image Grid**: array of images with captions
- **Feature List**: array of features with icon, title, description

### Step 2: Read Existing Block Patterns

Examine existing blocks to match project conventions:

```bash
# List existing blocks
ls -la src/blocks/
```

Read 1-2 existing block configs and components to understand:

- Directory structure
- Import patterns
- Field configurations
- Component structure
- Styling patterns

### Step 3: Create Block Directory Structure

Create directory for the new block:

```bash
mkdir -p src/blocks/<Name>
```

Expected structure:

```
src/blocks/<Name>/
├── config.ts      # Block configuration
└── Component.tsx  # React component
```

### Step 4: Generate Block Config

Create `src/blocks/<Name>/config.ts`:

```typescript
import type { Block } from 'payload'

export const <Name>Block: Block = {
  slug: '<slug>',
  interfaceName: '<Name>Block',
  labels: {
    singular: '<Name>',
    plural: '<Name>s',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      label: 'Heading',
    },
    // Add other fields based on requirements
  ],
}
```

**Field Type Examples for Blocks:**

```typescript
// Text field
{
  name: 'heading',
  type: 'text',
  required: true,
  label: 'Heading',
  admin: {
    description: 'Main heading text',
  },
}

// Textarea
{
  name: 'description',
  type: 'textarea',
  label: 'Description',
  admin: {
    rows: 3,
  },
}

// Rich Text
{
  name: 'content',
  type: 'richText',
  label: 'Content',
  required: true,
}

// Image Upload
{
  name: 'image',
  type: 'upload',
  relationTo: 'media',
  required: true,
  label: 'Background Image',
}

// Select
{
  name: 'alignment',
  type: 'select',
  label: 'Text Alignment',
  options: [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
  ],
  defaultValue: 'left',
}

// Checkbox
{
  name: 'fullWidth',
  type: 'checkbox',
  label: 'Full Width',
  defaultValue: false,
}

// Group (for related fields)
{
  name: 'button',
  type: 'group',
  label: 'Button',
  fields: [
    {
      name: 'text',
      type: 'text',
      required: true,
      label: 'Button Text',
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'Button URL',
    },
    {
      name: 'style',
      type: 'select',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
        { label: 'Outline', value: 'outline' },
      ],
      defaultValue: 'primary',
    },
  ],
}

// Array (for repeating items)
{
  name: 'features',
  type: 'array',
  label: 'Features',
  minRows: 1,
  maxRows: 6,
  fields: [
    {
      name: 'icon',
      type: 'text',
      label: 'Icon Name (lucide-react)',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
  ],
}
```

### Step 5: Generate React Component

Create `src/blocks/<Name>/Component.tsx`:

```typescript
import React from 'react'
import type { <Name>Block as <Name>BlockType } from '@/payload-types'

export const <Name>Block: React.FC<<Name>BlockType> = (props) => {
  const { heading } = props

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold">{heading}</h2>
        {/* Add other block content based on fields */}
      </div>
    </section>
  )
}
```

**Component Patterns:**

1. **Simple Block** (text only):

```typescript
export const HeroBlock: React.FC<HeroBlockType> = ({ heading, subheading, button }) => {
  return (
    <section className="relative min-h-[600px] flex items-center justify-center bg-gradient-to-br from-primary to-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">{heading}</h1>
        {subheading && (
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">{subheading}</p>
        )}
        {button && (
          <a
            href={button.url}
            className="inline-block px-8 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-white/90 transition"
          >
            {button.text}
          </a>
        )}
      </div>
    </section>
  )
}
```

2. **Block with Image**:

```typescript
import Image from 'next/image'
import type { Media } from '@/payload-types'

export const ImageContentBlock: React.FC<ImageContentBlockType> = ({ image, content }) => {
  const imageData = image as Media

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {imageData && (
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <Image
                src={imageData.url || ''}
                alt={imageData.alt || ''}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="prose prose-lg">
            {content}
          </div>
        </div>
      </div>
    </section>
  )
}
```

3. **Block with Array**:

```typescript
import { CheckCircle } from 'lucide-react'

export const FeatureListBlock: React.FC<FeatureListBlockType> = ({ heading, features }) => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{heading}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features?.map((feature, index) => (
            <div key={index} className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              {feature.description && (
                <p className="text-muted-foreground">{feature.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

### Step 6: Add Block to RenderBlocks

Find and read the RenderBlocks component:

```bash
# Find RenderBlocks component
find src -name "RenderBlocks.tsx" -o -name "RenderBlocks.ts"
```

Add the new block to the imports and switch statement:

```typescript
// Add import
import { <Name>Block } from '@/blocks/<Name>/Component'

// In the component's switch/map:
const blockComponents = {
  // ... existing blocks
  '<slug>': <Name>Block,
}
```

Or if using a switch statement:

```typescript
switch (block.blockType) {
  // ... existing cases
  case '<slug>':
    return <<Name>Block key={block.id} {...block} />
  // ...
}
```

### Step 7: Generate Types

Run Payload type generation:

```bash
pnpm generate:types
```

This generates TypeScript types for the new block in `src/payload-types.ts`.

### Step 8: Generate Import Map

Run import map generation (required for admin UI):

```bash
pnpm generate:importmap
```

This ensures the admin panel can find the component.

### Step 9: Verify TypeScript

Run TypeScript check:

```bash
pnpm -s tsc --noEmit
```

Fix any type errors that appear.

### Step 10: Test in Admin

1. Restart dev server if running:

```bash
# Kill and restart
pkill -f "next dev"
pnpm dev
```

2. Navigate to admin panel and find a page that uses blocks
3. Try adding the new block
4. Fill in the fields
5. Save and preview on the frontend

### Step 11: Provide Usage Examples

Show the user:

1. **How to use the block in a collection**:

```typescript
// In a collection config
fields: [
  {
    name: 'layout',
    type: 'blocks',
    blocks: [
      <Name>Block,
      // other blocks
    ],
  },
]
```

2. **Where to find the block in admin**:

```
Admin Panel → Collections → Pages → Edit Page → Layout → Add Block → <Name>
```

3. **How to customize the component**:

```typescript
// Edit src/blocks/<Name>/Component.tsx
// Modify styles, layout, or add interactivity
```

## Common Block Patterns

### Hero Block

```typescript
// config.ts
fields: [
  { name: 'heading', type: 'text', required: true },
  { name: 'subheading', type: 'textarea' },
  {
    name: 'backgroundImage',
    type: 'upload',
    relationTo: 'media',
  },
  {
    name: 'button',
    type: 'group',
    fields: [
      { name: 'text', type: 'text' },
      { name: 'url', type: 'text' },
    ],
  },
]
```

### Content Block

```typescript
// config.ts
fields: [
  {
    name: 'content',
    type: 'richText',
    required: true,
  },
  {
    name: 'width',
    type: 'select',
    options: [
      { label: 'Narrow', value: 'narrow' },
      { label: 'Medium', value: 'medium' },
      { label: 'Wide', value: 'wide' },
    ],
    defaultValue: 'medium',
  },
]
```

### Call to Action Block

```typescript
// config.ts
fields: [
  { name: 'heading', type: 'text', required: true },
  { name: 'description', type: 'textarea' },
  {
    name: 'primaryButton',
    type: 'group',
    fields: [
      { name: 'text', type: 'text', required: true },
      { name: 'url', type: 'text', required: true },
    ],
  },
  {
    name: 'secondaryButton',
    type: 'group',
    fields: [
      { name: 'text', type: 'text' },
      { name: 'url', type: 'text' },
    ],
  },
  {
    name: 'backgroundColor',
    type: 'select',
    options: [
      { label: 'Primary', value: 'primary' },
      { label: 'Secondary', value: 'secondary' },
      { label: 'Accent', value: 'accent' },
    ],
  },
]
```

### Image Gallery Block

```typescript
// config.ts
fields: [
  {
    name: 'images',
    type: 'array',
    minRows: 1,
    maxRows: 12,
    fields: [
      {
        name: 'image',
        type: 'upload',
        relationTo: 'media',
        required: true,
      },
      {
        name: 'caption',
        type: 'text',
      },
    ],
  },
  {
    name: 'columns',
    type: 'select',
    options: [
      { label: '2 Columns', value: '2' },
      { label: '3 Columns', value: '3' },
      { label: '4 Columns', value: '4' },
    ],
    defaultValue: '3',
  },
]
```

## Styling Best Practices

1. **Use Tailwind CSS** - Follow project conventions
2. **Container pattern** - Wrap content in container with max-width
3. **Responsive design** - Use md:, lg: breakpoints
4. **Spacing** - Use py-16 for vertical section padding
5. **Typography** - Follow text scale (text-4xl, text-3xl, etc.)
6. **Colors** - Use design tokens (primary, muted, etc.)

Example section wrapper:

```typescript
<section className="py-16 bg-background">
  <div className="container mx-auto px-4 max-w-7xl">
    {/* Content */}
  </div>
</section>
```

## Accessibility Considerations

- Use semantic HTML (section, h1-h6, p, button, a)
- Add alt text for images
- Ensure sufficient color contrast
- Make interactive elements keyboard accessible
- Use proper heading hierarchy

## Error Handling

Common issues and solutions:

1. **Block doesn't appear in admin**
   - Run `pnpm generate:importmap`
   - Restart dev server
   - Check that block is added to RenderBlocks

2. **Type errors**
   - Run `pnpm generate:types`
   - Check field names match between config and component
   - Ensure proper type imports

3. **Component not rendering**
   - Check RenderBlocks has correct block slug
   - Verify component is exported correctly
   - Check for console errors in browser

4. **Styles not applying**
   - Ensure Tailwind classes are valid
   - Check className prop is on correct element
   - Verify no conflicting styles

## Success Criteria

- [ ] Block config created at `src/blocks/<Name>/config.ts`
- [ ] Component created at `src/blocks/<Name>/Component.tsx`
- [ ] Block added to RenderBlocks component
- [ ] Types generated successfully (`pnpm generate:types`)
- [ ] Import map generated successfully (`pnpm generate:importmap`)
- [ ] TypeScript check passes (`pnpm -s tsc --noEmit`)
- [ ] Block appears in admin panel
- [ ] Block renders correctly on frontend
- [ ] Component is responsive and accessible

## Advanced Patterns

### Conditional Rendering

```typescript
export const ConditionalBlock: React.FC<ConditionalBlockType> = ({
  showImage,
  image,
  content
}) => {
  return (
    <section>
      {showImage && image && <Image {...} />}
      {content}
    </section>
  )
}
```

### Dynamic Styling

```typescript
const backgroundClasses = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  muted: 'bg-muted text-muted-foreground',
}

export const StyledBlock: React.FC<StyledBlockType> = ({ backgroundColor, content }) => {
  return (
    <section className={cn('py-16', backgroundClasses[backgroundColor])}>
      {content}
    </section>
  )
}
```

### Client Interactivity

```typescript
'use client'

import { useState } from 'react'

export const InteractiveBlock: React.FC<InteractiveBlockType> = ({ items }) => {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <section>
      {/* Interactive UI */}
    </section>
  )
}
```

## Related Documentation

- Project docs: [AGENTS.md](../../AGENTS.md) - Component development section
- Payload blocks: https://payloadcms.com/docs/fields/blocks
- Next.js Image: https://nextjs.org/docs/app/api-reference/components/image
- Tailwind CSS: https://tailwindcss.com/docs
