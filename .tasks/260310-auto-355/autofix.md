# Autofix Report: 260310-auto-355

## Errors Fixed

- Fixed test failures in `tests/unit/api/queue-v1-validation.test.ts` - Added `vi.stubEnv('PAYLOAD_SECRET', 'test-secret')` to stub the missing environment variable before importing the route module
- Fixed test failures in `tests/unit/api/queue-v2-validation.test.ts` - Added `vi.stubEnv('PAYLOAD_SECRET', 'test-secret')` to stub the missing environment variable before importing the route module

## Root Cause

The test files were importing route modules that load `payload.config.ts`, which requires the `PAYLOAD_SECRET` environment variable to be set. The tests were failing with "PAYLOAD_SECRET env var is required" because this environment variable was not available during test execution.

## Solution

Added `PAYLOAD_SECRET',vi.stubEnv(' 'test-secret')` at the top of both test files (before any imports) to mock the required environment variable. This follows the pattern used in other test files in the codebase that need environment variables stubbed.

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
- Tests: PASS (3209 passed, 17 skipped)
