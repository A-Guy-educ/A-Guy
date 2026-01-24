# Payload Access Control Deep Dive

**Status**: ✅ Complete - Production Ready
**Last Updated**: 2026-01-07

This guide provides comprehensive patterns for implementing secure access control in Payload CMS collections and fields.

---

## 📂 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Request (with user context)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Collection-Level Access Control                 │
│   { read, create, update, delete }                          │
│   - Boolean: allow/deny                                     │
│   - Query constraint: filter results                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Field-Level Access Control                      │
│   { read, create, update }                                  │
│   - Boolean only (no query constraints)                     │
│   - Controls field visibility                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Access (filtered by constraints)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Access Control Levels

### Level 1: Collection-Level Access

Controls which users can access an entire collection.

```typescript
// src/collections/Posts.ts
export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: anyone,              // Public read
    create: authenticated,     // Logged-in users can create
    update: isAdminOrOwner,    // Admin or owner can update
    delete: adminOnly,         // Admin only can delete
  },
  fields: [/* ... */],
}
```

### Level 2: Field-Level Access

Controls which users can see/edit specific fields.

```typescript
{
  name: 'salary',
  type: 'number',
  access: {
    read: ({ req: { user }, doc }) => {
      // User can see their own salary
      if (user?.id === doc?.id) return true
      // Admin can see all salaries
      return user?.role === 'admin'
    },
    update: ({ req: { user } }) => {
      // Only admin can update salary
      return user?.role === 'admin'
    },
  },
}
```

**Critical**: Field access MUST return boolean (no query constraints).

---

## 🎯 Built-in Access Functions

Located in [`src/server/payload/access/`](../../src/server/payload/access/):

| Function | Purpose | Returns | Use Case |
|----------|---------|---------|----------|
| [`anyone`](../../src/server/payload/access/anyone.ts) | Allow all users (including unauthenticated) | `true` | Public content |
| [`authenticated`](../../src/server/payload/access/authenticated.ts) | Allow only logged-in users | `boolean` | User-only features |
| [`adminOnly`](../../src/server/payload/access/adminOnly.ts) | Allow only admins | `boolean` | Admin operations |
| [`adminOrSelf`](../../src/server/payload/access/adminOrSelf.ts) | Admin or own records | `boolean \| query` | User profiles |
| [`authenticatedOrPublished`](../../src/server/payload/access/authenticatedOrPublished.ts) | Authenticated sees all, public sees published | `boolean \| query` | Draft/published content |

---

## 📋 Access Control Patterns

### Pattern 1: Public Content with Admin Management

```typescript
import { anyone } from '@/access/anyone'
import { adminOnly } from '@/access/adminOnly'

export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    read: anyone,              // ✅ Anyone can view
    create: adminOnly,         // ✅ Only admin can create
    update: adminOnly,         // ✅ Only admin can update
    delete: adminOnly,         // ✅ Only admin can delete
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'status', type: 'select', options: ['draft', 'published'] },
  ],
}
```

### Pattern 2: User-Owned Content

```typescript
import { authenticated } from '@/access/authenticated'
import { Role } from '@/collections/Users/roles'
import type { Access } from 'payload'

const isAdminOrOwner: Access = ({ req: { user } }) => {
  if (!user) return false

  // Admin can access all
  if (user.role === AccountRole.Admin) return true

  // User can only access their own records
  return {
    owner: { equals: user.id },
  }
}

export const Exercises: CollectionConfig = {
  slug: 'exercises',
  access: {
    read: anyone,
    create: authenticated,
    update: isAdminOrOwner,  // ✅ Query constraint
    delete: isAdminOrOwner,  // ✅ Query constraint
  },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      // Auto-set to current user
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            if (operation === 'create' && !value) {
              return req.user?.id
            }
            return value
          },
        ],
      },
    },
  ],
}
```

### Pattern 3: Published vs Draft Content

```typescript
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: authenticatedOrPublished,  // ✅ Authenticated sees all, public sees published
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: '_status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
  ],
}
```

**How it works**:
- Logged-in user: `return true` → sees ALL posts
- Public user: `return { _status: { equals: 'published' } }` → sees ONLY published posts

### Pattern 4: Field-Level Sensitive Data

```typescript
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  access: {
    read: authenticated,
    create: adminOnly,
    update: adminOrSelf,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      access: {
        read: ({ req: { user }, doc }) => {
          // User can see own email, admin can see all
          return user?.id === doc?.id || user?.role === 'admin'
        },
      },
    },
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'user'],
      access: {
        read: authenticated,     // All can read
        update: adminOnly,       // Only admin can change roles
      },
      saveToJWT: true,  // ✅ Include in JWT for fast access checks
    },
    {
      name: 'apiKey',
      type: 'text',
      access: {
        read: ({ req: { user }, doc }) => {
          // Only owner can see their API key
          return user?.id === doc?.id
        },
        update: ({ req: { user }, doc }) => {
          // Only owner can update their API key
          return user?.id === doc?.id
        },
      },
    },
  ],
}
```

---

## 🌳 Hierarchy Access Cascade

For hierarchical collections (Course → Chapter → Lesson → Exercise), access control can cascade.

### Pattern: Parent Status Filters Children

```typescript
// src/lib/queries/lessons.ts
export async function getPublishedLessons(chapterIds: string[]) {
  const payload = await getPayload({ config })

  return payload.find({
    collection: 'lessons',
    where: {
      and: [
        { chapter: { in: chapterIds } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
        // ✅ Filter by parent chapter status
        { 'chapter.status': { equals: 'published' } },
        { 'chapter.isActive': { equals: true } },
      ],
    },
    sort: 'order',
  })
}
```

**Why This Works**:
- Payload supports dot notation for relationship fields
- `'chapter.status'` filters by related chapter's status
- Ensures child is only visible if parent is also published

### Pattern: Breadcrumb Access Check

```typescript
// Check access through entire hierarchy
export async function canAccessExercise(
  exerciseId: string,
  user: User | null
): Promise<boolean> {
  const payload = await getPayload({ config })

  const exercise = await payload.findByID({
    collection: 'exercises',
    id: exerciseId,
    depth: 3, // Populate lesson → chapter → course
  })

  // Admin can access anything
  if (user?.role === 'admin') return true

  // Check all levels are published
  if (exercise.status !== 'published') return false
  if (exercise.lesson.status !== 'published') return false
  if (exercise.lesson.chapter.status !== 'published') return false
  if (exercise.lesson.chapter.course.status !== 'published') return false

  return true
}
```

---

## 🔐 RBAC Patterns

### Define Roles

```typescript
// src/collections/Users/roles.ts
export enum AccountRole {
  Admin = 'admin',
  Teacher = 'teacher',
  Student = 'student',
}

export const ROLE_HIERARCHY: Record<AccountRole, number> = {
  [AccountRole.Admin]: 3,
  [AccountRole.Teacher]: 2,
  [AccountRole.Student]: 1,
}

export function hasRoleLevel(userRole: AccountRole, requiredLevel: number): boolean {
  return ROLE_HIERARCHY[userRole] >= requiredLevel
}
```

### Multi-Role Access Control

```typescript
import { AccountRole, ROLE_HIERARCHY, hasRoleLevel } from '@/collections/Users/roles'
import type { Access } from 'payload'

const teacherOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role === AccountRole.Admin || user.role === AccountRole.Teacher
}

const canManageContent: Access = ({ req: { user } }) => {
  if (!user) return false
  return hasRoleLevel(user.role as Role, ROLE_HIERARCHY[Role.Teacher])
}

export const LessonPlans: CollectionConfig = {
  slug: 'lesson-plans',
  access: {
    read: teacherOrAdmin,
    create: teacherOrAdmin,
    update: teacherOrAdmin,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'teacherNotes',
      type: 'richText',
      access: {
        read: teacherOrAdmin,  // Students cannot see teacher notes
      },
    },
  ],
}
```

---

## 🧪 Testing Access Control

### Manual Test Checklist

For each collection, verify:

- [ ] **Unauthenticated user**
  - Can only access public content
  - Cannot create/update/delete
  - Cannot see sensitive fields

- [ ] **Authenticated user (student)**
  - Can see published content
  - Can create own content
  - Can update own content
  - Cannot update others' content
  - Cannot see admin-only fields

- [ ] **Admin user**
  - Can access all content
  - Can create/update/delete all
  - Can see all fields including sensitive

### Test Access Function

```typescript
// tests/access/access.test.ts
import { describe, it, expect } from 'vitest'
import { adminOnly } from '@/access/adminOnly'
import { adminOrSelf } from '@/access/adminOrSelf'

describe('Access Control', () => {
  it('adminOnly allows admin', () => {
    const result = adminOnly({
      req: { user: { role: 'admin' } },
    } as any)
    expect(result).toBe(true)
  })

  it('adminOnly denies non-admin', () => {
    const result = adminOnly({
      req: { user: { role: 'user' } },
    } as any)
    expect(result).toBe(false)
  })

  it('adminOrSelf allows admin to see all', () => {
    const result = adminOrSelf({
      req: { user: { id: '1', role: 'admin' } },
    } as any)
    expect(result).toBe(true)
  })

  it('adminOrSelf returns query for non-admin', () => {
    const result = adminOrSelf({
      req: { user: { id: '1', role: 'user' } },
    } as any)
    expect(result).toEqual({ id: { equals: '1' } })
  })
})
```

---

## 🚫 Common Pitfalls

### ❌ Pitfall 1: Missing Access Control

```typescript
// ❌ WRONG: No access control defined
export const BadCollection: CollectionConfig = {
  slug: 'bad',
  // Missing: access property
  fields: [/* ... */],
}

// ✅ CORRECT: Always define access
export const GoodCollection: CollectionConfig = {
  slug: 'good',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: adminOnly,
  },
  fields: [/* ... */],
}
```

### ❌ Pitfall 2: Field Access with Query Constraint

```typescript
// ❌ WRONG: Field access cannot use query constraints
{
  name: 'sensitive',
  type: 'text',
  access: {
    read: ({ req: { user } }) => {
      return { owner: { equals: user?.id } }  // Not allowed for fields!
    },
  },
}

// ✅ CORRECT: Field access must return boolean
{
  name: 'sensitive',
  type: 'text',
  access: {
    read: ({ req: { user }, doc }) => {
      return user?.id === doc?.owner  // Boolean
    },
  },
}
```

### ❌ Pitfall 3: Forgetting `overrideAccess` in Local API

```typescript
// ❌ WRONG: Access control bypassed (admin privileges)
await payload.find({
  collection: 'posts',
  user: someUser,  // Ignored without overrideAccess
})

// ✅ CORRECT: Enforce access control
await payload.find({
  collection: 'posts',
  user: someUser,
  overrideAccess: false,  // Required to enforce access control
})
```

### ❌ Pitfall 4: Not Setting Default Owner

```typescript
// ❌ WRONG: Owner not set automatically
export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    update: ({ req: { user } }) => {
      return { owner: { equals: user?.id } }
    },
  },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users' },
    // Missing: hook to auto-set owner
  ],
}

// ✅ CORRECT: Auto-set owner on create
{
  name: 'owner',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  hooks: {
    beforeChange: [
      ({ req, operation, value }) => {
        if (operation === 'create' && !value) {
          return req.user?.id
        }
        return value
      },
    ],
  },
  admin: {
    readOnly: true,  // Prevent manual changes
  },
}
```

---

## 📊 Access Control Decision Tree

```
User attempts operation on collection
│
├─ Is user authenticated?
│  ├─ NO → Check if operation allows unauthenticated (anyone)
│  │     ├─ YES → Allow
│  │     └─ NO → Deny
│  │
│  └─ YES → Check collection-level access
│        ├─ Access function returns boolean
│        │  ├─ true → Allow operation
│        │  └─ false → Deny
│        │
│        └─ Access function returns query constraint
│           └─ Apply constraint to filter results
│
└─ For each field in result:
   └─ Check field-level access (if defined)
      ├─ No field access → Include field
      └─ Field access defined → Check if user can read
         ├─ true → Include field
         └─ false → Exclude field from result
```

---

## 🔗 Related Documentation

- **[Payload Access Control](https://payloadcms.com/docs/access-control/overview)** - Official docs
- **[Course Hierarchy](../course-hierarchy/README.md)** - Hierarchy query patterns
- **[AGENTS.md](../../AGENTS.md)** - General Payload patterns
- **[Collections](../../src/server/payload/collections/README.md)** - Example implementations

---

## 📝 Access Control Checklist

When adding access control to a collection:

- [ ] **Collection-level access** defined for all operations (read, create, update, delete)
- [ ] **Public content** uses `anyone` for read access
- [ ] **User-owned content** has `owner` field with auto-set hook
- [ ] **Sensitive fields** have field-level access control
- [ ] **Admin-only operations** use `adminOnly` or check role
- [ ] **Query constraints** return object (not boolean) for row-level security
- [ ] **Field-level access** returns boolean only (no query constraints)
- [ ] **Roles saved to JWT** with `saveToJWT: true` for performance
- [ ] **Local API calls** use `overrideAccess: false` when passing user
- [ ] **Tests written** for all access scenarios

---

**Last Updated**: 2026-01-07
**Status**: ✅ Production Ready
