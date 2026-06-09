## Handoff: Fix Missing PAYLOAD_SECRET in inspector.yml

**Root cause:** The `Inspector` workflow (`inspector.yml`) runs `pnpm install` which triggers a `postinstall` script. That script calls `payload generate:types`, which loads `src/payload.config.ts`. The config requires `PAYLOAD_SECRET` to be set and throws `Error: PAYLOAD_SECRET env var is required` if absent.

**What I changed:** Added `PAYLOAD_SECRET` to the job-level `env` block in `.github/workflows/inspector.yml`, matching the pattern used in `ci.yml`:

```yaml
env:
  PAYLOAD_SECRET: ${{ secrets.PAYLOAD_SECRET || 'test-secret-for-ci' }}
```

This was added at the job level (above `steps:`) so it is in scope for both the `Install dependencies` step (where `postinstall` runs) and the `Run Inspector` step.

**Why the fix works:** The `payload.config.ts` accepts any non-empty string for `PAYLOAD_SECRET`; the value is only used for cryptographic signing. A CI-friendly placeholder is sufficient for the type-generation step.
