# Gap Analysis: 260225-auto-93

## Summary

- Gaps Found: 7
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing UserSettings Collection

**Severity:** Critical
**Location:** Collections needed: `UserSettings`
**Issue:** The spec references UserSettings as if it exists, but this collection does not exist in the codebase. The spec also mentions "UserSettings.teacherProfile field (modify)" in task.json but there's no UserSettings collection to modify.
**Fix Applied:** Added FR-001: Create UserSettings collection with 1:1 relationship to Users

### Gap 2: Missing Auto-Creation Mechanism for UserSettings

**Severity:** High
**Location:** Users collection hooks
**Issue:** The spec states "UserSettings must be automatically created on user signup" but doesn't define HOW this happens. There's no hook or transactional mechanism defined.
**Fix Applied:** Added FR-002: Create afterCreate hook on Users collection to auto-create UserSettings

### Gap 3: Missing Configuration for Default TeacherProfile

**Severity:** High
**Location:** Configuration system (ConfigValues or environment)
**Issue:** The spec mentions "default is resolved at configuration level" and "system-configured default Teacher Profile" but doesn't specify WHERE this configuration lives (environment variable, ConfigValues, hardcoded fallback).
**Fix Applied:** Added FR-003: Define default profile configuration (environment variable DEFAULT_TEACHER_PROFILE_SLUG with fallback to ConfigValues)

### Gap 4: Chat Orchestrator Integration Path Not Defined

**Severity:** High
**Location:** Chat endpoint integration (`src/server/payload/endpoints/agent/chat/prompt-composition.ts`)
**Issue:** The spec describes the integration steps but the current implementation uses a different flow: lesson.prompt → course.prompt → default (via Prompts collection's isDefaultForAgentChat). The TeacherProfile wrapper adds an additional layer that needs clear integration points.
**Fix Applied:** Added FR-004: Extend composeFullSystemInstructions to accept optional TeacherProfile parameter and inject teacher_profile block in correct order

### Gap 5: Memory/Vector Pipeline Exclusion Not Implemented

**Severity:** Medium
**Location:** Memory extraction and vector search pipelines
**Issue:** The spec states "Do NOT pass this block into memory extraction" and "Do NOT include in vector search embedding" but there's no implementation guidance on how to exclude it.
**Fix Applied:** Added FR-005: Add context flag to exclude teacher_profile from memory extraction calls

### Gap 6: Translation Keys Missing for UI

**Severity:** Medium
**Location:** Frontend translations
**Issue:** The UI uses `t('teachersProfilePlaceholder')` and `t('sectionTeachersProfile')` but no translation keys exist in messages/en.json or messages/he.json.
**Fix Applied:** Added NFR-001: Add i18n keys for teacher profile UI strings

### Gap 7: Guest Behavior Mechanism Not Defined

**Severity:** Medium
**Location:** Guest session handling
**Issue:** The spec states guests always use the configured default profile, but the mechanism isn't clear - should guests have a default set in their session, or should it be resolved per-request?
**Fix Applied:** Added clarification in FR-004 that guest requests resolve default profile at request time

## Changes Made to Spec

### Added Functional Requirements:

- **FR-001**: Create `TeacherProfiles` collection with fields: slug (unique, indexed), label, description, systemPrompt (relationship to Prompts, required), isEnabled (boolean). Access: Admin full access, read access for authenticated users.

- **FR-002**: Create `UserSettings` collection with fields: user (relationship to users, 1:1, required), teacherProfile (relationship to TeacherProfiles, optional). Access: User can read/update own record, admin full access, create/delete restricted.

- **FR-003**: Create afterCreate hook on Users collection to auto-create UserSettings record with null teacherProfile in the same transaction.

- **FR-004**: Modify chat endpoint to resolve TeacherProfile: Load UserSettings.teacherProfile, if null use DEFAULT_TEACHER_PROFILE_SLUG env var or ConfigValues, fetch full TeacherProfiles entity, load systemPrompt. Inject teacher_profile block BEFORE lesson context in system prompt composition.

- **FR-005**: Add implementation detail that teacher_profile block is passed as separate parameter to composePrompt to exclude from memory extraction (memory extraction should receive only base instructions + lesson context).

- **FR-006**: Seed data: 5 Prompts entries (teacher behavior text) + 5 TeacherProfiles entries linking to those Prompts. Default profile slug: `teacher_focused`.

### Added Non-Functional Requirements:

- **NFR-001**: Add i18n keys: `auth.account.teachersProfilePlaceholder`, `auth.account.sectionTeachersProfile`, `auth.account.selectTeacherProfile`, `auth.account.currentTeacherProfile`, `auth.account.profileChanged`

- **NFR-002**: Performance: TeacherProfile resolution should be cached per request or use shallow user lookup

### Updated Acceptance Criteria:

- Added: "UserSettings collection exists and auto-created on signup"
- Added: "Default profile configurable via DEFAULT_TEACHER_PROFILE_SLUG env var"
- Added: "Teacher profile resolved at request time (not stored in JWT)"
- Added: "Translation keys exist for all UI strings"
- Clarified: "Guest behavior - default profile resolved per-request"
