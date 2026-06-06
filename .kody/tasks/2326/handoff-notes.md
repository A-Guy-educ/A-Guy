## CI Failure Analysis for PR #2326

**Failure type**: Environmental (not a code defect)

**Root cause**: Docker Hub registry (`registry-1.docker.io`) was unreachable from the GitHub Actions runner. The `docker pull mongo:7` command failed with:
- `context deadline exceeded`
- `net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers)`

This caused the "Initialize containers" step in the Integration Tests job to fail.

**Resolution**: No code changes needed. The failure is in CI infrastructure, not in the PR code. The PR's actual changes (fixing the admin dashboard footer to read version from `package.json` instead of the `NEXT_PUBLIC_APP_VERSION` env var) are correct — all quality gates (typecheck, lint, unit tests) pass locally.

**PR changes already committed**: The fix for issue #2274 was implemented in prior commits on this branch:
- `src/ui/admin/VersionInfo/index.tsx` — reads version from `package.json?raw`
- `src/env.d.ts` + `src/types/package-json-raw.d.ts` — TypeScript declarations for `?raw` imports
- `tests/unit/admin/version-info.test.tsx` — unit test verifying version display
- Login page i18n fix (`LoginForm.tsx`, `LoginPageContent.tsx`)
- CSP fix for Gravatar (`next.config.js`)
- Lesson duplication review stats counter fix

**Recommendation**: Re-run the CI workflow — the Docker Hub connectivity issue was transient.
