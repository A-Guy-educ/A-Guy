# PR #2203 CI Fix — Dependency Security Report (Daily)

## What happened
The "Dependency Security Report (Daily)" CI workflow failed during `pnpm install` because the `postinstall` hook runs `pnpm generate`, which loads `payload.config.ts` and throws if `DATABASE_URL` is not set.

## Root cause
- The security report workflow runs `pnpm install --frozen-lockfile`, triggering `postinstall`
- `postinstall` called `pnpm generate` (which runs `generate:types` then `generate:importmap`)
- A prior session fixed payload.config.ts to skip DATABASE_URL validation when `PAYLOAD_GENERATE_TYPES=true` or `CI=true`
- However, `cross-env PAYLOAD_GENERATE_TYPES=true` in `generate:types` only sets the env var for the immediate `payload` child process — not for nested processes that `payload` spawns to load and validate config
- Since `CI` is not reliably set in all GitHub Actions runners, both guards failed and the validation fired

## Fix
Set `PAYLOAD_GENERATE_TYPES=true` directly in the `postinstall` script so it is inherited by all child processes spawned by `payload generate:types`:

```json
"postinstall": "cross-env PAYLOAD_GENERATE_TYPES=true pnpm generate"
```

This ensures the env var is set before any `payload` process loads `payload.config.ts`.
