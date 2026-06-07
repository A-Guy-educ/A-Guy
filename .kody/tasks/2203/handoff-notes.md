Verified that the fix from task gh-27091218975-1 is correctly in place:
- `.github/workflows/deps-security-report.yml` now has `PAYLOAD_SECRET: ${{ secrets.PAYLOAD_SECRET || 'test-secret-for-ci' }}` at the job `env` level (line 21).
- This matches the pattern used in `ci.yml` and `atlas-integration.yml`.

The failing run (27086250150, scheduled at 07:34 UTC on 2026-06-07) predated the fix (committed at 11:33 UTC the same day). The scheduled workflow uses the workflow file as-of when the run starts, so that run did not have `PAYLOAD_SECRET` — causing the postinstall script to fail when `payload generate:types` was invoked.

No additional changes needed. Future scheduled runs and workflow_dispatch runs will have the secret available.