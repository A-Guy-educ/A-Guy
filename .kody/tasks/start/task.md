# Bug: captureAndRespond leaks internal error messages to clients (CWE-209)

## Bug Description

`captureAndRespond` in `src/server/api/capture-and-respond.ts` includes the raw internal error message in the HTTP response body:

```typescript
// Line 29
return NextResponse.json({ error: 'Internal server error', message }, { status: 500 })
```

Where `message` is extracted from the caught error:
```typescript
const message = error instanceof Error ? error.message : 'Unknown error'
```

This function is used across many API routes (progress, conversations, blob uploads, message persist, etc.). Internal error messages from MongoDB, Payload CMS, or other libraries can contain database field names, collection names, query structures, or stack traces that should never be exposed to clients.

The same issue exists in `src/app/api/exercises/validate-answer/route.ts` line 37: `details: error instanceof Error ? error.message : 'Unknown error'`.

## Impact

**Information disclosure (CWE-209)**. Attackers can learn internal database structure, ORM layer, and server configuration by triggering errors.

## Suggested Fix

Return only the generic message, not the internal error details:

```typescript
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
```

The detailed message is already captured in the logger and Sentry. Do the same for the `validate-answer` route.

## Complexity

Easy — straightforward removal of the `message` field from error responses.