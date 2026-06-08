# Merge Conflict Resolution - PR #2474

## Files Resolved

### next.config.js
- **Conflict**: HEAD added `worker-src 'self' blob:;` to admin CSP; origin/dev had no worker-src directive
- **Resolution**: Kept HEAD's version with `worker-src 'self' blob:;`
- **Rationale**: Monaco editor creates web workers using blob: URLs, which are blocked without explicit `blob:` in worker-src

### tests/int/csp-vercel-feedback-admin.int.spec.ts
- **Conflict**: HEAD added a new `worker-src` test; origin/dev split the gravatar img-src test into two
- **Resolution**: Kept HEAD's worker-src test + first gravatar test (origin/dev's second gravatar test was redundant with first)
- **Rationale**: The worker-src test validates the next.config.js change; the extra gravatar test from origin/dev was functionally equivalent to the first

## Verification
- TypeScript: passes (`npx tsc --noEmit`)
- Integration tests: 5/5 pass (`pnpm exec vitest run tests/int/csp-vercel-feedback-admin.int.spec.ts`)
