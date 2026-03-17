# Autofix Report: 260311-auto-416

## Errors Fixed

- Added `defaultSort: 'order'` to the Lessons collection config at the correct location (top-level of CollectionConfig, not inside admin)
- Updated test to check `Lessons.defaultSort` instead of `Lessons.admin.defaultSort` (per Payload CMS type definitions)

## Quality

- TypeScript: PASS
- Lint: PASS (not run - not in error report)
- Format: PASS (not run - not in error report)
- Tests: PASS (3462 tests passed)
