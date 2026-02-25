# Gap Analysis: 260225-auto-21

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Accordion Component

**Severity:** High
**Location:** src/ui/web/components/
**Issue:** The spec requires an accordion-based layout with collapsible sections, but there is no existing Accordion or Collapsible component in `src/ui/web/components/`. The codebase has Card, Button, Badge, etc., but no accordion primitives.
**Fix Applied:** Added FR-ACC-001: "Create Accordion component using Radix UI @radix-ui/react-accordion as base, with proper TypeScript types"

### Gap 2: Profile Picture Field Missing

**Severity:** High
**Location:** src/server/payload/collections/Users/index.ts
**Issue:** The spec lists "Profile Picture" in the Details section, but the Users collection does not have a `profilePicture` field. The existing user fields are: name, role, googleSub, verifiedEmail, registrationMethod, registeredAt, googleProfile, oauthLoginSecretEnc.
**Fix Applied:** Added FR-ACC-002: "Details section displays only available user fields (name, email). Profile Picture is OUT OF SCOPE for Phase 1"

### Gap 3: Missing Translation Keys

**Severity:** Medium
**Location:** src/i18n/en.json, src/i18n/he.json
**Issue:** The spec requires section titles (Details, Courses, Preferences, Teachers Profile) but there are no translation keys for these. The existing `auth.account` namespace only has: title, name, email, missing, selectedCourse, noCourseSelected, selectCourse, removeCourseSelection, loadingCourse.
**Fix Applied:** Added FR-ACC-003: "Add translation keys: sections.details, sections.courses, sections.preferences, sections.teachersProfile, sections.expand, sections.collapse"

### Gap 4: Courses Section Ambiguity

**Severity:** Medium
**Location:** src/app/(frontend)/account/
**Issue:** The spec says "List of enrolled courses - Reuse SelectedCourseCard" but SelectedCourseCard shows ONE selected course (not a list). The current implementation displays a single course or "no course selected" state. If there are multiple enrolled courses, the component architecture doesn't support it.
**Fix Applied:** Added FR-ACC-004: "Clarify Courses section: reuse SelectedCourseCard for single selected course. Empty state if no course selected."

### Gap 5: RTL Chevron Direction Not Specified

**Severity:** Low
**Location:** UI implementation
**Issue:** The spec mentions "Respect RTL/LTR for chevron direction" but doesn't specify how the chevron rotation should work in RTL. In LTR, chevrons typically rotate 180° to point right when expanded. In RTL, the default chevron should point left (start direction) and rotate to point right when expanded.
**Fix Applied:** Added NFR-ACC-002: "Chevron rotation: LTR - rotate from down to right on expand. RTL - rotate from down to left on expand. Use document.dir or useLocale() hook for direction detection."

## Changes Made to Spec

### Added Functional Requirements

- **FR-ACC-001:** Create Accordion component with single-expand mode (only one section open at a time)
- **FR-ACC-002:** Details section displays user.name and user.email (profile picture is out of scope)
- **FR-ACC-003:** Add translation keys for section titles and interaction labels
- **FR-ACC-004:** Courses section reuses SelectedCourseCard component for selected course display
- **FR-ACC-005:** Implement deep linking via ?section= query param with fallback to Details

### Added Non-Functional Requirements

- **NFR-ACC-001:** Performance: Lazy render courses if > 5 items (use React.lazy or similar)
- **NFR-ACC-002:** RTL Support: Chevron rotation direction flips based on document.dir

### Updated Acceptance Criteria

- [x] Clarified: Details shows name + email (no profile picture)
- [x] Clarified: Courses uses existing SelectedCourseCard component
- [x] Added: Placeholders for Preferences and Teachers Profile sections
- [x] Added: Translation keys must be added before implementation
- [x] Added: Accordion component must be created or sourced from Radix UI
