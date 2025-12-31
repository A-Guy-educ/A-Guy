# File Naming & Organization Protocol

This document defines strict rules for naming files, folders, and organizing code to ensure every file's purpose is immediately obvious.

## Core Principle

**NO MYSTERY FILES.** Every file name must clearly communicate:

1. What domain/feature it belongs to
2. What it does
3. Its type (component, action, handler, util, etc.)

## File Naming Rules

### 1. Descriptive Names (NO abc.py)

❌ **BAD - Vague names:**

```
actions.ts          # Which actions?
utils.ts            # Which utilities?
helpers.ts          # Helpers for what?
index.ts            # What does this export?
```

✅ **GOOD - Clear, specific names:**

```
signupActions.ts    # Signup-related server actions
authUtils.ts        # Authentication utilities
dateHelpers.ts      # Date formatting helpers
UserList.tsx        # User list component
```

### 2. Feature Prefixing

When multiple files belong to the same feature, prefix them with the feature name:

```
src/app/(frontend)/signup/
├── signup_actions.ts       # Server actions for signup
├── signup_validation.ts    # Client-side validation
├── signup_schemas.ts       # Zod schemas
├── signup_handlers.ts      # Error/success handlers
├── signup_rateLimit.ts     # Rate limiting logic
├── signup_turnstile.ts     # CAPTCHA verification
├── SignupForm.tsx          # Main component (React convention)
├── SignupFormFields.tsx    # Sub-component
└── signup_page.tsx         # Page component
```

**Rationale:** Prefixing groups related files alphabetically and makes their relationship obvious.

### 3. Type Suffixes

Use suffixes to indicate file type/purpose:

| Suffix           | Purpose                      | Example                |
| ---------------- | ---------------------------- | ---------------------- |
| `_actions.ts`    | Server actions               | `signup_actions.ts`    |
| `_handlers.ts`   | Event/error handlers         | `signup_handlers.ts`   |
| `_utils.ts`      | Utility functions            | `auth_utils.ts`        |
| `_schemas.ts`    | Zod schemas & types          | `signup_schemas.ts`    |
| `_validation.ts` | Validation logic             | `signup_validation.ts` |
| `_types.ts`      | TypeScript type definitions  | `user_types.ts`        |
| `_page.tsx`      | Next.js page                 | `signup_page.tsx`      |
| `Component.tsx`  | React component (PascalCase) | `SignupForm.tsx`       |

### 4. Folder Organization

#### Option A: Flat with Prefixes (Preferred for small features)

```
signup/
├── signup_actions.ts
├── signup_handlers.ts
├── signup_rateLimit.ts
├── signup_turnstile.ts
├── signup_validation.ts
├── signup_schemas.ts
├── signup_page.tsx
├── SignupForm.tsx
└── SignupFormFields.tsx
```

#### Option B: Nested Folders (For large features with many files)

```
signup/
├── actions/
│   ├── signup_createUser.ts
│   ├── signup_verifyEmail.ts
│   └── signup_autoLogin.ts
├── handlers/
│   ├── signup_errorHandlers.ts
│   └── signup_successHandlers.ts
├── validation/
│   ├── signup_clientValidation.ts
│   └── signup_schemas.ts
├── components/
│   ├── SignupForm.tsx
│   └── SignupFormFields.tsx
└── signup_page.tsx
```

**Rule:** Use Option A unless you have 10+ files in a single category.

## Anti-Patterns to Avoid

### ❌ Generic Names

```typescript
// BAD
utils.ts // What utilities?
helpers.ts // Helpers for what?
actions.ts // Which actions?
index.ts // Barrel file obscuring actual code
```

### ❌ Abbreviations Without Context

```typescript
// BAD
auth.ts // Is this actions? utils? types?
usr_mgmt.ts // Hard to search for
rl.ts // Rate limit? Ridiculous!
```

### ❌ Mixed Concerns in Single File

```typescript
// BAD: signup.ts containing actions + validation + types + handlers
// This violates separation of concerns AND makes the file too large
```

## React Component Naming

React components follow different conventions:

### Component Files: PascalCase

```
SignupForm.tsx              # Main component
SignupFormFields.tsx        # Sub-component
UserProfileCard.tsx         # Component
```

### Component Support Files: Prefixed

```
SignupForm/
├── SignupForm.tsx                  # Component
├── SignupForm_styles.module.css    # Styles (if not using Tailwind)
├── SignupForm_utils.ts             # Component-specific utilities
└── SignupForm_types.ts             # Component-specific types
```

## Page Naming

Next.js pages should use the pattern `{feature}_page.tsx`:

```
(frontend)/
├── signup/
│   └── signup_page.tsx       # /signup route
├── login/
│   └── login_page.tsx        # /login route
└── profile/
    └── profile_page.tsx      # /profile route
```

**Exception:** `page.tsx` is acceptable for the root route or when the folder name is already descriptive.

## Examples by Feature Type

### Authentication Feature

```
auth/
├── auth_actions.ts           # Login, logout, signup actions
├── auth_utils.ts             # Token validation, cookie helpers
├── auth_schemas.ts           # Zod schemas
├── auth_types.ts             # TypeScript types
├── LoginForm.tsx             # Components
├── SignupForm.tsx
└── logout_action.ts          # Standalone action if complex
```

### User Management

```
users/
├── users_actions.ts          # CRUD actions
├── users_queries.ts          # Database queries
├── users_validation.ts       # Validation logic
├── users_types.ts            # User-related types
├── UserList.tsx              # Components
├── UserCard.tsx
└── users_page.tsx
```

### Exercise System

```
exercises/
├── exercise_actions.ts       # Server actions
├── exercise_renderer.tsx     # Renderer component
├── exercise_types.ts         # Type definitions
├── exercise_validation.ts    # Answer validation
├── ExerciseEditor.tsx        # Admin component
└── exercises_page.tsx
```

## Special Cases: When Fields/Code Appear Unused

Sometimes code intentionally looks unused or has misleading names (e.g., anti-spam honeypots, security measures). **Always document these with comments.**

### Honeypot Fields (Anti-Spam)

Honeypot fields are invisible form fields that trap bots. They MUST:

1. Have believable names (e.g., `website`, `company`, `phone`)
2. **Never** be named `honeypot` (bots would ignore it)
3. Have clear comments explaining the pattern

```typescript
// ✅ GOOD - Documented honeypot
export const SignupSchema = z.object({
  name: z.string(),
  email: z.string(),
  // ANTI-SPAM: Honeypot field. Invisible to users, but bots fill it.
  // If filled, submission is rejected before validation.
  // Named 'website' (believable) so bots think it's legitimate.
  website: z.string().optional(),
})

// In the component:
<input
  type="text"
  name="website"  {/* Matches schema field */}
  style={{ position: 'absolute', left: '-9999px' }}  {/* Hidden from users */}
  tabIndex={-1}
  aria-hidden="true"
/>
```

**Key Learning:** If a field/variable appears in a schema but seems unused, it's likely an intentional pattern. Add comments explaining WHY.

## Checklist for New Files

Before creating a file, ask:

1. ✅ Does the name clearly indicate what feature it belongs to?
2. ✅ Does the name clearly indicate what it does?
3. ✅ Does the name use the correct suffix for its type?
4. ✅ If it's part of a group, is it prefixed consistently?
5. ✅ Is it placed in the correct folder?
6. ✅ Will someone unfamiliar with the codebase understand it immediately?
7. ✅ If code appears unused/misleading, is it documented with comments?

## Migration Strategy

When refactoring existing code:

1. Identify all files in a feature
2. Group them by type (actions, handlers, utils, etc.)
3. Apply consistent prefixing
4. Update all imports
5. Commit with clear message explaining the reorganization

---

**Remember:** Code is read far more often than it's written. Invest in clarity upfront.
