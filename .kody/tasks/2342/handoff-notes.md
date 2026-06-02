# Task 2342: dev CI is red — Fast Gate failure

## What was wrong
The Fast Gate CI job was failing due to a Prettier formatting issue in `kody.config.json`.

## Fix applied
Ran `pnpm exec prettier --write kody.config.json` to fix the formatting. The file was likely modified by a previous Kody run or job that left it unformatted.

## Verification
All Fast Gate steps pass locally:
- `pnpm typecheck` ✅
- `pnpm lint` ✅ (warnings only, no errors)
- `pnpm format:check` ✅
- `pnpm test:unit -- --coverage` ✅ (3338 tests passed)

Quality gates (`verify` tool) confirm: `ok: true`.
