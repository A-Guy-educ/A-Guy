# ESLint Plugin for A-Guy Platform

Custom ESLint rules to enforce A-Guy platform patterns and best practices.

## Installation

The plugin is already included in this project. No additional installation needed.

## Rules

### ✅ `aguy/require-collection-access` (error)

**Ensures all Payload collections have access control defined.**

This is a **critical security requirement**. All collections must explicitly define access control for all CRUD operations.

```typescript
// ❌ BAD - No access control
export const MyCollection: CollectionConfig = {
  slug: 'my-collection',
  fields: [],
}

// ✅ GOOD - Access control defined
export const MyCollection: CollectionConfig = {
  slug: 'my-collection',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [],
}
```

### ✅ `aguy/no-nested-metadata` (error)

**Prevents nested objects in Payload collection fields.**

Payload does not support deeply nested metadata. Use flat field structures instead.

```typescript
// ❌ BAD - Nested metadata not supported
{
  name: 'user',
  type: 'group',
  fields: [
    { name: 'profile', type: 'json' }
  ]
}

// ✅ GOOD - Flat structure
{
  name: 'userName',
  type: 'text'
}
```

### ⚠️ `aguy/tailwind-only-components` (warn)

**Enforces Tailwind-only styling in frontend components.**

SCSS imports are not allowed in components (except admin components). Use Tailwind CSS utilities instead.

```typescript
// ❌ BAD - SCSS import
import './MyComponent.module.scss'

// ✅ GOOD - Tailwind only
<div className="bg-primary text-white rounded-md px-4 py-2">
  Content
</div>
```

### ✅ `aguy/require-auth-endpoints` (error)

**Requires authentication checks in API endpoints.**

All API endpoints must check authentication unless explicitly documented as public.

```typescript
// ❌ BAD - No auth check
export async function POST(req: NextRequest) {
  const data = await req.json()
  // Missing: authentication check
}

// ✅ GOOD - Auth check present
export async function POST(req: NextRequest) {
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... handle request
}

// ✅ ALSO GOOD - Documented as public
export async function GET(req: NextRequest) {
  // public endpoint - no auth required
  const data = await fetchPublicData()
  return NextResponse.json(data)
}
```

## Usage

### Enable in ESLint Config

Add to your `eslint.config.mjs`:

```javascript
import aguyPlugin from './eslint-plugin-aguy/index.js'

export default [
  {
    plugins: {
      aguy: aguyPlugin,
    },
    rules: {
      'aguy/require-collection-access': 'error',
      'aguy/no-nested-metadata': 'error',
      'aguy/tailwind-only-components': 'warn',
      'aguy/require-auth-endpoints': 'error',
    },
  },
]
```

### Run Linting

```bash
# Check for issues
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

## Rule Details

### Severity Levels

- **error** - Critical issues that must be fixed (security, data integrity)
- **warn** - Best practices that should be followed (style, maintainability)

### File Scope

- `require-collection-access` - Only checks files with CollectionConfig
- `no-nested-metadata` - Only checks collection field definitions
- `tailwind-only-components` - Only checks `/components/` and `/app/` (excluding `/components/admin/`)
- `require-auth-endpoints` - Only checks `/api/` and `/endpoints/` routes

## Future Enhancements

Planned rules for future releases:

- `require-field-labels` - Ensure i18n labels on fields
- `no-hardcoded-secrets` - Prevent credential leaks
- `require-zod-validation` - Enforce input validation
- `require-error-handling` - Ensure try/catch blocks

## Contributing

To add a new rule:

1. Create rule file in `eslint-plugin-aguy/rules/your-rule.js`
2. Export rule from `eslint-plugin-aguy/index.js`
3. Add tests for the rule
4. Update this README with documentation

## Resources

- [ESLint Custom Rules](https://eslint.org/docs/latest/extend/custom-rules)
- [A-Guy Documentation](../docs/ai/README.md)
- [Pattern Index](../docs/ai/indexes/pattern-index.json)
