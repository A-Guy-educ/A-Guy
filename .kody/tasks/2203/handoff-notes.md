# PR #2203 CI Fix (Hygiene Workflow)

## What happened
The "Repo Hygiene Report (Daily)" CI workflow failed during `pnpm install` because the `postinstall` hook runs `pnpm generate`, which loads `payload.config.ts` and validates that `DATABASE_URL` is set.

## Root cause
- The hygiene workflow runs `pnpm install --frozen-lockfile`
- This triggers the `postinstall` hook (`pnpm generate` → `generate:types` → loads `payload.config.ts`)
- `payload.config.ts` line 93 throws if `DATABASE_URL` is not set or empty
- Although the workflow has `DATABASE_URL` env with a fallback value, the validation was failing

## Fix
Added `--ignore-scripts` to skip the postinstall hook in the hygiene workflow:

```yaml
# Before
pnpm install --frozen-lockfile

# After
pnpm install --frozen-lockfile --ignore-scripts
```

The hygiene report (`repo:hygiene:report`) only runs `knip` and git commands — it has no need for database access or Payload type generation.
