# Gap Analysis: 260226-add-missing-indexes

## Summary

- Gaps Found: 10
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing index on Courses.status

**Severity:** High
**Location:** src/server/payload/collections/Courses.ts, line 108
**Issue:** The status field (lines 108-129) has no index. Status is frequently queried to filter published content.
**Fix Applied:** Updated spec line number from 104 to 108.

### Gap 2: Missing index on Chapters.status

**Severity:** High
**Location:** src/server/payload/collections/Chapters.ts, line 106
**Issue:** The status field (lines 106-127) has no index. Status is frequently queried to filter published chapters.
**Fix Applied:** Updated spec line number from 104 to 106.

### Gap 3: Missing index on Lessons.status

**Severity:** High
**Location:** src/server/payload/collections/Lessons.ts, line 120
**Issue:** The status field (lines 120-141) has no index. Status is frequently queried to filter published lessons.
**Fix Applied:** Updated spec line number from 116 to 120.

### Gap 4: Missing index on Tenants.status

**Severity:** Medium
**Location:** src/server/payload/collections/Tenants.ts, line 37
**Issue:** The status field (lines 37-47) has no index. Status is queried to filter active tenants.
**Fix Applied:** Spec line number was correct (37).

### Gap 5: Missing index on Courses.categories

**Severity:** High
**Location:** src/server/payload/collections/Courses.ts, line 172
**Issue:** The categories relationship field (lines 172-180) has no index. Categories are frequently used to filter courses.
**Fix Applied:** Updated spec with line number 172.

### Gap 6: Missing index on Posts.authors

**Severity:** High
**Location:** src/server/payload/collections/Posts/index.ts, line 186
**Issue:** The authors relationship field (lines 186-193) has no index. Authors are frequently used to filter posts.
**Fix Applied:** Updated spec with line number 186.

### Gap 7: Missing index on Posts.categories

**Severity:** High
**Location:** src/server/payload/collections/Posts/index.ts, line 125
**Issue:** The categories relationship field (lines 125-132) has no index. Categories are frequently used to filter posts.
**Fix Applied:** Updated spec with line number 125.

### Gap 8: Missing index on Exercises.sourceDoc

**Severity:** Medium
**Location:** src/server/payload/collections/Exercises/index.ts, line 177
**Issue:** The sourceDoc relationship field (lines 177-181) has no index. This field is used to track conversion source.
**Fix Applied:** Updated spec with line number 177.

### Gap 9: Missing index on ConfigAuditLogs.tenant

**Severity:** Medium
**Location:** src/server/payload/collections/ConfigAuditLogs.ts, line 49
**Issue:** The tenant relationship field (lines 49-56) has no index. Tenant is frequently used to filter audit logs.
**Fix Applied:** Updated spec with line number 49.

### Gap 10: Missing index on GuestSessions.claimedByUser

**Severity:** Medium
**Location:** src/server/payload/collections/GuestSessions.ts, line 148
**Issue:** The claimedByUser relationship field (lines 148-155) has no index. This field is used when users claim guest sessions.
**Fix Applied:** Updated spec with line number 148.

## Changes Made

- Updated line number for Courses.status: 104 → 108
- Updated line number for Chapters.status: 104 → 106
- Updated line number for Lessons.status: 116 → 120
- Added line number 172 for Courses.categories
- Added line number 186 for Posts.authors
- Added line number 125 for Posts.categories
- Added line number 177 for Exercises.sourceDoc
- Added line number 49 for ConfigAuditLogs.tenant
- Added line number 148 for GuestSessions.claimedByUser

## No Other Gaps Identified

The codebase already has indexes on many other commonly queried fields:
- Courses: courseLabel, title, prompt, slug (already indexed)
- Chapters: course, chapterLabel, title, slug (already indexed)
- Lessons: chapter, type, title, prompt, slug (already indexed)
- Tenants: slug (already indexed)
- ConfigAuditLogs: key, actor (already indexed)
- GuestSessions: tokenHash, createdAt, lastActiveAt, expiresAt, hardExpiresAt, ipHash, status (already indexed)

The spec correctly identifies all 10 fields that need new indexes added.
