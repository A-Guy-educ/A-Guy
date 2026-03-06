# Task

## Issue Title

Refactor: Cody API routes use blanket eslint-disable, no-explicit-any, and lack input validation
## Description

All five Cody dashboard API routes have `/* eslint-disable @typescript-eslint/no-explicit-any */` at the file level, use `catch (error: any)` for error handling, and lack structured input validation (no Zod schemas).

The rest of the codebase uses proper Zod schemas and typed error handling, but these routes were written as a quick prototype and never hardened.

## Current Behavior

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */

// No input validation:
const owner = searchParams.get('owner')  // Could be anything

// Unsafe error handling:
catch (error: any) {
  if (error.status === 401) {  // Could throw if error is not an object
    return NextResponse.json({ error: 'Unauthorized' })
  }
}
```

Issues:
1. Error properties accessed without type checking
2. GitHub API errors could leak internal details to clients
3. Query parameter validation is minimal (just null checks)
4. Error responses are inconsistent across endpoints

## Expected Behavior

```typescript
// Proper Zod validation:
const querySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
})

// Type-safe error handling:
catch (error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

## Files to Change

- `src/app/api/cody/prs/route.ts`
- `src/app/api/cody/prs/files/route.ts`
- `src/app/api/cody/workflows/route.ts`
- `src/app/api/cody/pipeline/[taskId]/route.ts`
- `src/app/api/cody/boards/route.ts`
- Create: shared GitHub API error handler utility

## Complexity

Complex — 5 API route files + 1 shared utility, requires consistent error handling pattern across all routes.

## Labels

refactor, security, typescript
