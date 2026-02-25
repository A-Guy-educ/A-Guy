# Gap Analysis: 260225-auto-93

## Summary

- Gaps Found: 7
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing UserSettings Collection

**Severity:** Critical
**Location:** Collections needed: `UserSettings`
**Issue:** The spec references UserSettings as if it exists, but this collection does not exist in the codebase. The task.json also mentions "UserSettings.teacherProfile field (modify)" but there's no UserSettings collection to modify.
**Fix Applied:** Spec updated: Added full collection definition for UserSettings with user (1:1 relationship) and teacherProfile fields. Added auto-creation mechanism via afterCreate hook on Users.

### Gap 2: Missing Auto-Creation Mechanism for UserSettings

**Severity:** High
**Location:** Users collection hooks
**Issue:** The spec states "UserSettings must be automatically created on user signup" but doesn't define HOW this happens. There's no hook or transactional mechanism defined.
**Fix Applied:** Spec updated: Added explicit "Auto-creation mechanism" section defining afterCreate hook on Users with req.payload.create for transaction safety.

### Gap 3: Missing Configuration for Default TeacherProfile

**Severity:** High
**Location:** Configuration system (ConfigValues or environment)
**Issue:** The spec mentions "default is resolved at configuration level" and "system-configured default Teacher Profile" but doesn't specify WHERE this configuration lives (environment variable, ConfigValues, hardcoded fallback).
**Fix Applied:** Spec updated: Added "Default resolution order" with explicit priority: 1) DEFAULT_TEACHER_PROFILE_SLUG env var, 2) ConfigValues domain='teacher_profiles', 3) hardcoded fallback.

### Gap 4: Chat Orchestrator Integration Path Not Defined

**Severity:** High
**Location:** Chat endpoint integration (`src/server/payload/endpoints/agent/chat/prompt-composition.ts`)
**Issue:** The spec describes the integration steps but the current implementation uses a different flow: lesson.prompt → course.prompt → default (via Prompts collection's isDefaultForAgentChat). The TeacherProfile wrapper adds an additional layer that needs clear integration points.
**Fix Applied:** Spec updated: Added explicit implementation detail that teacher_profile should be passed as separate parameter to composePrompt() to exclude from memory extraction.

### Gap 5: Memory/Vector Pipeline Exclusion Not Implemented

**Severity:** Medium
**Location:** Memory extraction and vector search pipelines
**Issue:** The spec states "Do NOT pass this block into memory extraction" and "Do NOT include in vector search embedding" but there's no implementation guidance on how to exclude it.
**Fix Applied:** Spec updated: Added implementation detail in Chat Orchestrator Integration section: "Pass teacher_profile as separate parameter to composePrompt(). Memory extraction function should accept optional excludeTeacherProfile flag."

### Gap 6: Translation Keys Missing for UI

**Severity:** Medium
**Location:** Frontend translations
**Issue:** The UI uses `t('teachersProfilePlaceholder')` and `t('sectionTeachersProfile')` but no translation keys exist in messages/en.json or messages/he.json.
**Fix Applied:** Spec updated: Added "Required i18n keys" section with 5 translation keys that must be added.

### Gap 7: Guest Behavior Mechanism Not Defined

**Severity:** Medium
**Location:** Guest session handling
**Issue:** The spec states guests always use the configured default profile, but the mechanism isn't clear - should guests have a default set in their session, or should it be resolved per-request?
**Fix Applied:** Spec updated: Added clarification that "Guest requests use default profile (resolved per-request)" in Guest Behavior section.

## Changes Made to Spec

### Data Model Section:
- Added full UserSettings collection definition with fields and access control
- Added explicit auto-creation mechanism with afterCreate hook

### Chat Orchestrator Integration Section:
- Added Step 1 and Step 2 with detailed resolution flow
- Added implementation detail for memory extraction exclusion
- Clarified guest behavior (per-request resolution)

### Default Strategy Section:
- Added explicit resolution order (env var → ConfigValues → hardcoded fallback)
- Added requirement that default slug must exist in seed data

### UI Behavior Section:
- Added reference to existing placeholder component
- Added Required i18n keys section with 5 translation keys

### Acceptance Criteria:
- Updated from 10 to 17 criteria to cover all requirements
- Added criteria for: collection existence, auto-creation, memory exclusion, env var config, i18n, guest behavior
