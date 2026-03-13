# Autofix Report: 260313-auto-867

## Errors Fixed

- Fixed test failure in `tests/unit/scripts/cody/cody-utils-extended.test.ts`: The test "should discover task-id from issue when triggerType is comment" was failing because it was mocking `childProcess.execFileSync` but the `discoverTaskIdFromIssue` function in `github-api.ts` uses its own import of `execFileSync`. Added proper mocking of the `github-api` module by:
  1. Adding `vi.mock('../../../../scripts/cody/github-api', ...)` to mock the module
  2. Importing `discoverTaskIdFromIssue` from the mocked module
  3. Updating the test to use `vi.mocked(discoverTaskIdFromIssue).mockReturnValue(...)` instead of mocking `childProcess.execFileSync`

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
- Tests: PASS (3336 passed, 17 skipped)
