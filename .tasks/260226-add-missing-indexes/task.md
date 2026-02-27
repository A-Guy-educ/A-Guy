# Task

## Issue Title

[MEDIUM] Performance: Missing indexes on status and relationship fields
## Description
Several frequently queried fields are missing `index: true`, causing full collection scans in MongoDB.

## Status Fields Missing Index
| Collection | File | Line | Field |
|-----------|------|------|-------|
| courses | `src/server/payload/collections/Courses.ts` | 104 | `status` |
| chapters | `src/server/payload/collections/Chapters.ts` | 104 | `status` |
| lessons | `src/server/payload/collections/Lessons.ts` | 116 | `status` |
| tenants | `src/server/payload/collections/Tenants.ts` | 37 | `status` |

## Relationship Fields Missing Index
| Collection | File | Field | Priority |
|-----------|------|-------|----------|
| courses | `Courses.ts` | `categories` | HIGH — admin defaultColumn, frontend filter |
| posts | `Posts/index.ts` | `authors` | HIGH — used in populateAuthors hook |
| posts | `Posts/index.ts` | `categories` | HIGH — common frontend filter |
| exercises | `Exercises/index.ts` | `sourceDoc` | MEDIUM — conversion pipeline lookups |
| config_audit_logs | `ConfigAuditLogs.ts` | `tenant` | MEDIUM — admin filtered by tenant |
| guest-sessions | `GuestSessions.ts` | `claimedByUser` | MEDIUM — session upgrade query |

## Expected Fix
Add `index: true` to each field definition:
```typescript
{ name: 'status', type: 'select', options: [...], index: true }
{ name: 'categories', type: 'relationship', relationTo: 'categories', index: true }
```

## Priority
MEDIUM — Performance optimization, becomes critical at scale
