# Build Agent Report: 260226-add-missing-indexes

## Changes

- **Courses.ts**: Added `index: true` to `status` field (line 108) and `categories` field (line 172)
- **Chapters.ts**: Added `index: true` to `status` field (line 106)
- **Lessons.ts**: Added `index: true` to `status` field (line 120)
- **Tenants.ts**: Added `index: true` to `status` field (line 37)
- **Posts/index.ts**: Added `index: true` to `categories` field (line 125, nested in tabs) and `authors` field (line 186)
- **Exercises/index.ts**: Added `index: true` to `sourceDoc` field (line 177)
- **ConfigAuditLogs.ts**: Added `index: true` to `tenant` field (line 49)
- **GuestSessions.ts**: Added `index: true` to `claimedByUser` field (line 148)

## Tests Written

- `tests/unit/collections/collection-indexes.spec.ts` - 10 tests verifying all 10 fields have `index: true`
  - 4 status field tests: Courses.status, Chapters.status, Lessons.status, Tenants.status
  - 6 relationship field tests: Courses.categories, Posts.categories, Posts.authors, Exercises.sourceDoc, ConfigAuditLogs.tenant, GuestSessions.claimedByUser

## Quality

- TypeScript: PASS
- Lint: PASS (only pre-existing warnings)
- Unit tests: 2400 passed (including 10 new collection-indexes tests)
