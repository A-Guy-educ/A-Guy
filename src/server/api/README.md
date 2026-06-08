# API Utilities

**@ai-summary** Shared infrastructure for Next.js API routes: auth guards, request-scoped logging, standardized response/error factories, and a route-wrapper that owns the try/catch.

---

## Entry Point

Every API route file (`src/app/api/*/route.ts`) should use `withApiHandler` as the outer wrapper. The individual route modules under `src/server/api/` are never imported directly by route files — they are re-exported through `responses.ts` or referenced by `withApiHandler`.

## File Map

| File                     | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `with-api-handler.ts`    | Route wrapper — auth, body/query parsing, logging, Sentry capture |
| `auth.ts`                | Auth guards (`isAuthenticated`, `requireAdmin`, etc.)             |
| `logger.ts`              | Request-scoped logger factory                                     |
| `responses.ts`           | `apiSuccess` / `apiError` / `ApiErrors.*` factories + Zod parsers |
| `capture-and-respond.ts` | Unhandled-exception handler for routes that skip `withApiHandler` |
| `schemas/job-schemas.ts` | Zod schemas for job queue endpoints                               |
| `index.ts`               | Barrel re-exporting `responses.ts`                                |

## Gotchas

- `withApiHandler`'s catch block treats operational errors (`ValidationError`, messages containing "not found" or "already exists") as **400** — everything else is a **500**. Do not rely on this for business-logic errors that should return a different code.
- `requireAdminOrTestSecret` allows `TEST_ADMIN_SECRET` bearer token as a backdoor in non-production environments — never call it with unvalidated user input.
- `schemas/job-schemas.ts` uses a stricter ObjectId regex (24-char hex only) than Payload's default — reusing it for other collections without adjustment will reject valid IDs.
