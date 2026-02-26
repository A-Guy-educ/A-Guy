# Spec: Add Missing Database Indexes

## Overview

Add MongoDB indexes to frequently queried fields to improve query performance and prevent full collection scans.

## Requirements

### Status Fields (4 collections)
Add `index: true` to status select fields in:
1. `Courses.ts` - line 104, field: status
2. `Chapters.ts` - line 104, field: status
3. `Lessons.ts` - line 116, field: status
4. `Tenants.ts` - line 37, field: status

### Relationship Fields (6 collections)
Add `index: true` to relationship fields in:
1. `Courses.ts` - field: categories (HIGH priority)
2. `Posts/index.ts` - field: authors (HIGH priority)
3. `Posts/index.ts` - field: categories (HIGH priority)
4. `Exercises/index.ts` - field: sourceDoc (MEDIUM priority)
5. `ConfigAuditLogs.ts` - field: tenant (MEDIUM priority)
6. `GuestSessions.ts` - field: claimedByUser (MEDIUM priority)

## Acceptance Criteria

- [ ] All 10 fields have `index: true` added
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] No breaking changes to existing functionality
- [ ] Code follows existing field definition patterns in codebase
