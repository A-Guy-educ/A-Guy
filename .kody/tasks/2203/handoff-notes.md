Fixed the Dependency Security Report (Daily) CI failure.

Root cause: `deps-security-report.yml` did not set the `PAYLOAD_SECRET` env var. When `pnpm install --frozen-lockfile` ran, it triggered the `postinstall` script (`cross-env PAYLOAD_GENERATE_TYPES=true pnpm generate`), which calls `payload generate:types`. Payload validates PAYLOAD_SECRET at startup and throws `Error: PAYLOAD_SECRET env var is required` if it's missing.

Fix: Added `PAYLOAD_SECRET: ${{ secrets.PAYLOAD_SECRET || 'test-secret-for-ci' }}` to the job-level `env` block in `deps-security-report.yml`, matching the pattern used in `ci.yml` and `atlas-integration.yml`. A fallback value is appropriate here since the dependency security report only needs to install deps and run a script — no real Payload initialization is needed.
