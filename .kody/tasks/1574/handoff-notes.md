# Fix Stale Payload Types

## What was fixed

The `src/payload-types.ts` file contained types for a `payload-mcp-api-keys` collection that no longer exists in `payload.config.ts`. This caused the `check-types-drift.ts` script (run as part of `pnpm typecheck`) to fail in CI.

## How it was fixed

1. Ran `pnpm generate:types` to regenerate the types file
2. The regenerated file no longer contains the stale `payload-mcp-api-keys` references (160 lines removed, 11 added)
3. Committed as `12150ecb4 fix: regenerate stale payload-types.ts`
4. Pushed to `1570-feat-show-per-message-timestamp-in-admin-chat`

## Verification

- `pnpm typecheck` passes (types drift check passes)
- `pnpm lint` passes (warning only, not error)
- `pnpm format:check` passes

## Follow-up

The `payload.config.ts` still has a stale comment referencing `PayloadMcpApiKey` at lines 77-86. This is a low-priority cleanup since the code itself only checks the `users` collection.
