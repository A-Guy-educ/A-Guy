# Thin App Layer

`src/app/**` is a thin composition layer only: routing + params parsing + calls to services + UI composition.

## Allowed Imports by File Type

### SSR Pages/Layout: `src/app/**/{page,layout}.tsx`

**Allowed:**

- `@/server/services/**` - Preferred for business logic
- `@/server/repos/queries/**` - ONLY read-only single-call queries
- `@/ui/**` - UI components
- `next/*` - Navigation, headers

**Forbidden:**

- Direct Payload (`payload`, `@/server/payload/**`)
- Repos outside `/queries/**`
- `@/infra/llm/**`, `@/infra/pdfjs/**`, `@/infra/analytics/**`

**Policy:** Max 1 query call per SSR page unless via service.

### Route Handlers: `src/app/**/route.ts`

**Allowed:**

- `@/server/services/**` - ONLY allowed
- `next/server`, `next/headers`

**Forbidden:**

- `@/server/repos/**`
- Direct Payload
- `@/infra/llm/**`, `@/infra/pdfjs/**`, `@/infra/analytics/**`

### Server Actions: `src/app/**/actions/**`

**Convention:** `'use server'` allowed ONLY in `src/app/**/actions/**`

**Allowed:**

- `@/server/services/**` - ONLY allowed

**Forbidden:**

- `@/server/repos/**`
- Direct Payload
- `@/infra/llm/**`, `@/infra/pdfjs/**`, `@/infra/analytics/**`

## File Structure Allowlist

**Allowed files:**

- `{page,layout,loading,error,not-found}.tsx`
- `route.ts`
- `actions/**`
- `_components/**` (colocated UI only)

**Forbidden:**

- `src/app/**/{lib,utils,helpers}/`
- Any `.ts/.tsx` outside allowed list

## Heavy Transforms Forbidden

The following on query results are forbidden in `src/app/**`:

- `.map`, `.filter`, `.reduce`, `.sort`
- Building view models / DTOs beyond trivial pick
- Merging results from multiple queries
- Decision trees / permission rules

**If it makes a decision → it does NOT belong in `app`.**
