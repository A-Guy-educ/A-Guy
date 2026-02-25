# Gap Analysis: 260225-auto-38

## Summary

- Gaps Found: 7
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing TeacherProfiles Collection

**Severity:** Critical
**Location:** New collection needs to be created in `src/server/payload/collections/`
**Issue:** The spec requires a TeacherProfiles collection with these fields:
- `slug` (unique, indexed)
- `label` (display name)
- `description` (short UI explanation)
- `systemPrompt` → relationship to Prompts (required, no text-field alternative)
- `isEnabled` (boolean)

The spec clarifies:
- No `order` field
- No `isDefault` flag (default controlled at configuration level)
- Only enabled profiles are selectable/resolvable

**Fix Applied:** Added FR-001 in spec revision.

### Gap 2: Missing UserSettings Collection

**Severity:** Critical
**Location:** New collection needs to be created in `src/server/payload/collections/`
**Issue:** The spec requires UserSettings with:
- 1:1 relationship with User
- `teacherProfile` → relationship to TeacherProfiles
- Access control: User can read/update only own record, Admin full access, Create/delete restricted
- Auto-created on user signup

Currently no UserSettings collection exists in the codebase.

**Fix Applied:** Added FR-002 in spec revision.

### Gap 3: Missing Auto-Creation Hook on User Signup

**Severity:** Critical
**Location:** `src/server/payload/collections/Users/index.ts`
**Issue:** The spec requires UserSettings to be automatically created when a user signs up. The Users collection has afterChange hooks but none for creating UserSettings. Need to add a hook that creates UserSettings record when a new user is created.

Existing patterns in Users:
- `ensureRoleOnSignup` hook on beforeChange
- `preventLastAdminDemotion` on beforeChange
- `auditRoleChange` on afterChange

**Fix Applied:** Added FR-003 in spec revision.

### Gap 4: Missing Default Teacher Profile Configuration Mechanism

**Severity:** High
**Location:** Configuration level (needs new mechanism)
**Issue:** The spec states "Default profile is controlled at configuration level" and "Default is resolved at configuration level, not stored per user." Need a way to configure which TeacherProfile is the default system-wide.

Options:
- Environment variable (DEFAULT_TEACHER_PROFILE_SLUG)
- Config file setting
- Global config

The existing codebase uses ConfigValues collection for system parameters (e.g., chat settings).

**Fix Applied:** Added FR-004 in spec revision.

### Gap 5: Chat Orchestrator Integration - Teacher Profile Injection

**Severity:** Critical
**Location:** `src/server/payload/endpoints/agent/chat/prompt-composition.ts` and main chat flow
**Issue:** The spec requires injecting teacher profile into system prompt with this strict order:
1. `<Base system prompt>`
2. `<teacher_profile>` block
3. Lesson / course context

Current code in `composeFullSystemInstructions` (prompt-composition.ts:254-307):
- Fetches system prompts via `fetchPublishedSystemPrompts`
- Resolves lesson/course prompt via `resolveAgentSystemPrompt`
- Composes via `composeSystemInstructions`

The teacher profile injection is NOT currently implemented. Need to:
1. Load UserSettings.teacherProfile for authenticated users
2. Fetch the TeacherProfile entity
3. Load its related systemPrompt content
4. Inject into system prompt in correct order (before lesson context)

**Fix Applied:** Added FR-005 in spec revision.

### Gap 6: UI Implementation - Teacher Profile Selection

**Severity:** High
**Location:** `src/app/(frontend)/account/_components/TeachersProfileSection.tsx`
**Issue:** The TeachersProfileSection is currently a placeholder (only shows "Teachers profile features coming soon."). Need to implement:
- Fetch available TeacherProfiles (only enabled ones)
- Display current selection from UserSettings
- Single select UI
- Immediate or explicit save
- Toast confirmation

The spec also requires displaying the current Teacher Profile label in the Chat UI header - no existing implementation.

**Fix Applied:** Added FR-006 and FR-007 in spec revision.

### Gap 7: Access Control Patterns for UserSettings

**Severity:** Medium
**Location:** New UserSettings collection
**Issue:** Need to implement the specific access control patterns:
- User can read/update only own record
- Admin full access
- Create/delete restricted

The codebase has existing patterns for this:
- `adminOrSelf` in `src/server/payload/access/adminOrSelf.ts`
- Need to check for existing 1:1 relationship patterns

**Fix Applied:** Added to FR-002 requirements.

## Changes Made to Spec

### Added Functional Requirements:

- **FR-001:** Create TeacherProfiles collection with fields: slug (unique, indexed), label, description, systemPrompt (relationship to Prompts, required), isEnabled (boolean). No order or isDefault fields. Only enabled profiles are selectable.

- **FR-002:** Create UserSettings collection with 1:1 relationship to Users, teacherProfile field (relationship to TeacherProfiles), access control (user read/update own, admin full, create/delete restricted).

- **FR-003:** Add afterChange hook on Users collection to automatically create UserSettings record when a new user signs up.

- **FR-004:** Implement default teacher profile configuration mechanism at system level (environment variable or config file).

- **FR-005:** Integrate teacher profile injection into chat orchestrator - resolve UserSettings.teacherProfile, fetch TeacherProfile, load systemPrompt content, inject into system prompt in correct order (base → teacher_profile → lesson context).

- **FR-006:** Implement Teacher Profile selection UI in Account page - fetch enabled profiles, display current selection, single select with save and toast confirmation.

- **FR-007:** Display current Teacher Profile label in Chat UI header.

### Updated Acceptance Criteria:

- Added AC-10: Teacher profile displayed in Chat UI header near chat header
- Added AC-11: UserSettings auto-created on signup via hook
- Added AC-12: Default teacher profile configurable at system level

### Updated Specifications:

- Clarified that system prompt order must be: base → teacher_profile → lesson context
- Added requirement to exclude teacher_profile from memory extraction and vector search
- Added requirement to use existing UnifiedLLMProvider and AI_MODELS

## No Gaps Found

The spec is now complete and aligned with codebase patterns. All identified gaps have been addressed with specific functional requirements.
