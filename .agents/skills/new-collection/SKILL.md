---
name: new-collection
description: Generate a new Payload collection with best practices, access control, and type safety
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create New Payload Collection

This skill generates a new Payload CMS collection following project conventions and best practices.

## What This Skill Does

1. Gathers collection requirements from user
2. Reads existing collection patterns for consistency
3. Generates collection config file with proper TypeScript types
4. Adds collection to `payload.config.ts`
5. Runs type generation and validates no errors
6. Provides usage examples

## Workflow

### Step 1: Gather Requirements

Ask the user for:

- **Collection name** (e.g., "Posts", "Products", "Comments")
- **Slug** (e.g., "posts", "products", "comments") - auto-suggest from name
- **Primary field** for admin title (default: "title")
- **Access control level**:
  - `public` - Anyone can read, authenticated can write
  - `authenticated` - Only authenticated users
  - `admin` - Admin users only
  - `custom` - User will provide custom access functions
- **Key fields** (at minimum, include a title/name field):
  - Field name, type, and whether required
  - Common types: text, textarea, richText, number, date, select, relationship

### Step 2: Read Existing Patterns

Before generating, examine existing collections to match patterns:

```bash
# Find existing collections
ls src/collections/*.ts
```

Read 1-2 existing collections to understand:

- Import patterns
- Field configurations
- Access control patterns
- Admin UI conventions

### Step 3: Generate Collection File

Create `src/collections/<Name>.ts` using this template:

```typescript
import type { CollectionConfig } from 'payload'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
// Add other access imports as needed

export const <Name>: CollectionConfig = {
  slug: '<slug>',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone, // or authenticated based on requirements
    update: authenticated,
  },
  admin: {
    useAsTitle: '<primaryField>',
    defaultColumns: ['<primaryField>', 'updatedAt'],
    description: 'Manage <collection description>',
  },
  fields: [
    {
      name: '<primaryField>',
      type: 'text',
      required: true,
      minLength: 1,
      maxLength: 200,
    },
    // Add other fields based on requirements
  ],
  timestamps: true, // adds createdAt and updatedAt
}
```

**Field Type Examples:**

```typescript
// Text field
{
  name: 'title',
  type: 'text',
  required: true,
  minLength: 1,
  maxLength: 200,
}

// Rich text field
{
  name: 'content',
  type: 'richText',
  required: true,
}

// Number field
{
  name: 'price',
  type: 'number',
  required: true,
  min: 0,
}

// Select field
{
  name: 'status',
  type: 'select',
  required: true,
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
  ],
  defaultValue: 'draft',
}

// Date field
{
  name: 'publishedAt',
  type: 'date',
  admin: {
    date: {
      pickerAppearance: 'dayAndTime',
    },
  },
}

// Relationship field
{
  name: 'author',
  type: 'relationship',
  relationTo: 'users',
  required: true,
}

// Checkbox field
{
  name: 'featured',
  type: 'checkbox',
  defaultValue: false,
}
```

### Step 4: Add to Payload Config

Read the current `src/payload.config.ts`:

```bash
# Read the config file
cat src/payload.config.ts | grep -A 20 "collections:"
```

Add the new collection to the collections array:

```typescript
import { <Name> } from './collections/<Name>'

// In the config object:
collections: [
  // ... existing collections
  <Name>,
],
```

Use the Edit tool to add:

1. Import statement at the top
2. Collection reference in the collections array

### Step 5: Generate Types

Run Payload type generation:

```bash
pnpm generate:types
```

Check for errors. If successful, the types will be in `src/payload-types.ts`.

### Step 6: Verify TypeScript

Run TypeScript check to ensure no errors:

```bash
pnpm -s tsc --noEmit
```

If errors occur:

- Review the collection config for typos
- Check that all imported access functions exist
- Verify relationship `relationTo` references valid collections

### Step 7: Provide Usage Examples

Show the user:

1. **How to query the collection** (Local API):

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

// Find all
const result = await payload.find({
  collection: '<slug>',
  where: {
    // filters
  },
})

// Find by ID
const item = await payload.findByID({
  collection: '<slug>',
  id: '<id>',
})

// Create
const newItem = await payload.create({
  collection: '<slug>',
  data: {
    <primaryField>: 'Example',
    // other fields
  },
})
```

2. **How to access in admin panel**:

```
http://localhost:3000/admin/collections/<slug>
```

3. **REST API endpoints** (if REST plugin enabled):

```
GET    /api/<slug>       - List all
GET    /api/<slug>/:id   - Get by ID
POST   /api/<slug>       - Create
PATCH  /api/<slug>/:id   - Update
DELETE /api/<slug>/:id   - Delete
```

## Access Control Patterns

### Public Read, Authenticated Write

```typescript
access: {
  create: authenticated,
  delete: authenticated,
  read: anyone,
  update: authenticated,
},
```

### Fully Authenticated

```typescript
access: {
  create: authenticated,
  delete: authenticated,
  read: authenticated,
  update: authenticated,
},
```

### Admin Only

```typescript
import { admins } from '../access/admins'

access: {
  create: admins,
  delete: admins,
  read: admins,
  update: admins,
},
```

### Custom (User Owns Records)

```typescript
access: {
  create: authenticated,
  delete: ({ req: { user } }) => {
    // User can only delete their own records
    if (!user) return false
    return {
      createdBy: { equals: user.id }
    }
  },
  read: anyone,
  update: ({ req: { user } }) => {
    // User can only update their own records
    if (!user) return false
    return {
      createdBy: { equals: user.id }
    }
  },
},
```

For custom access, you may need to add a `createdBy` field:

```typescript
{
  name: 'createdBy',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  admin: {
    hidden: true,
  },
  hooks: {
    beforeChange: [
      ({ req }) => req.user?.id,
    ],
  },
}
```

## Admin UI Configuration

### Default Columns

Show the most important fields in list view:

```typescript
admin: {
  defaultColumns: ['title', 'status', 'author', 'updatedAt'],
}
```

### Custom List View

```typescript
admin: {
  useAsTitle: 'title',
  defaultColumns: ['title', 'status', 'updatedAt'],
  description: 'Manage blog posts',
  group: 'Content', // Group in sidebar
  pagination: {
    defaultLimit: 50,
  },
}
```

### Hide from Admin

If collection should be hidden:

```typescript
admin: {
  hidden: true,
}
```

## Common Field Patterns

### Slug Field (Auto-generate from Title)

```typescript
{
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (!value && data?.title) {
          return data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
        }
        return value
      },
    ],
  },
}
```

### Status Field

```typescript
{
  name: 'status',
  type: 'select',
  required: true,
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
  ],
  defaultValue: 'draft',
  admin: {
    position: 'sidebar',
  },
}
```

### Featured/Priority Field

```typescript
{
  name: 'featured',
  type: 'checkbox',
  defaultValue: false,
  admin: {
    position: 'sidebar',
  },
}
```

## Hooks Example

Add hooks for common patterns:

```typescript
export const Posts: CollectionConfig = {
  slug: 'posts',
  // ... other config
  hooks: {
    // Set createdBy on creation
    beforeChange: [
      ({ req, data, operation }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
        }
        return data
      },
    ],
    // Log after creation
    afterChange: [
      ({ doc, operation, req }) => {
        if (operation === 'create') {
          console.log(`New post created: ${doc.title}`)
        }
      },
    ],
  },
}
```

## Validation

Add custom validation if needed:

```typescript
{
  name: 'email',
  type: 'email',
  required: true,
  validate: (value) => {
    if (!value?.includes('@')) {
      return 'Must be a valid email address'
    }
    return true
  },
}
```

## Error Handling

Common issues and solutions:

1. **Type generation fails**
   - Check for syntax errors in collection config
   - Ensure all imports are correct
   - Verify field types are valid

2. **Collection doesn't appear in admin**
   - Check that it's added to `payload.config.ts`
   - Verify access control allows admin access
   - Restart dev server

3. **TypeScript errors**
   - Run `pnpm generate:types` again
   - Check for typos in field names
   - Ensure relationship `relationTo` references exist

## Automated Scaffolding

This skill includes an automated script that generates a new collection file.

### Usage

```bash
# CLI mode - all options
npx tsx .agents/skills/new-collection/scripts/scaffold-collection.ts \
  --name Products \
  --slug products \
  --access public \
  --fields "name:text:required,price:number:required,category:relationship" \
  --with-tenant

# Interactive mode - prompts for missing inputs
npx tsx .agents/skills/new-collection/scripts/scaffold-collection.ts

# Dry run - preview without writing
npx tsx .agents/skills/new-collection/scripts/scaffold-collection.ts --name Posts --dry-run
```

### Options

| Option              | Description                                       | Default                |
| ------------------- | ------------------------------------------------- | ---------------------- |
| `--name <Name>`     | PascalCase collection name (required in CLI mode) | -                      |
| `--slug <slug>`     | kebab-case slug                                   | auto-derived from name |
| `--access <level>`  | Access: public, authenticated, admin, custom      | admin                  |
| `--fields <spec>`   | Field spec: "name:type:required"                  | title:text:required    |
| `--with-tenant`     | Include tenantField                               | false                  |
| `--with-created-by` | Include createdByField                            | false                  |
| `--primary-field`   | Field for admin title                             | title                  |
| `--description`     | Admin description                                 | auto-generated         |
| `--path <dir>`      | Custom collections directory                      | auto-detect            |
| `--dry-run`         | Preview without writing                           | false                  |

### Supported Field Types

`text`, `textarea`, `richText`, `number`, `select`, `checkbox`, `date`, `email`, `relationship`, `upload`

### Path Auto-Discovery

The script automatically detects the collections directory from:

1. `--path` CLI argument
2. `src/server/payload/collections`
3. `src/collections`
4. `collections`

### Examples

```bash
# Simple collection
npx tsx .../scaffold-collection.ts --name Posts --access public

# With multiple fields
npx tsx .../scaffold-collection.ts --name Products --fields "name:text:required,price:number:required,status:select"

# Custom path
npx tsx .../scaffold-collection.ts --name Custom --path src/my-collections
```

## Success Criteria

- [ ] Collection file created at `src/collections/<Name>.ts`
- [ ] Collection added to `payload.config.ts`
- [ ] Types generated successfully (`pnpm generate:types` passes)
- [ ] TypeScript check passes (`pnpm -s tsc --noEmit`)
- [ ] Collection appears in admin panel
- [ ] User understands how to query and use the collection

## Notes

- Always use existing access functions (`anyone`, `authenticated`, `admins`) unless custom logic is needed
- Follow the project's naming conventions (PascalCase for collection names, kebab-case for slugs)
- Add useful admin descriptions to help users understand the collection's purpose
- Consider adding indexes for fields that will be queried frequently
- Use `admin.position: 'sidebar'` for metadata fields to keep the main form clean

## Related Documentation

- Project docs: [AGENTS.md](../../../AGENTS.md) - Payload patterns section
- Payload docs: https://payloadcms.com/docs/configuration/collections
- Access control: https://payloadcms.com/docs/access-control/overview
