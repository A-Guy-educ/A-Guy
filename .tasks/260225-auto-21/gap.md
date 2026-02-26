# Gap Analysis: 260225-auto-21

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: No Accordion Component Exists

**Severity:** Critical
**Location:** src/ui/web/components/
**Issue:** The spec requires an accordion-based layout, but there is NO existing Accordion or Collapsible component in `src/ui/web/components/`. The codebase has Card, Button, Badge, etc., but no accordion primitives.
**Fix Applied:** Added explicit note in FR-001 and NFR-001 that Accordion component must be created first. Added to Guardrails.

### Gap 2: Profile Picture Field Missing

**Severity:** Critical
**Location:** src/server/payload/collections/Users/index.ts
**Issue:** FR-002 originally mentioned "Profile Picture" but the Users collection does NOT have a `profilePicture` field. Existing user fields: name, role, googleSub, verifiedEmail, registrationMethod, registeredAt, googleProfile, oauthLoginSecretEnc.
**Fix Applied:** Updated FR-002 to note "Profile Picture is OUT OF SCOPE" and added to Out of Scope section.

### Gap 3: Wrong i18n Library Specified

**Severity:** High
**Location:** NFR-003
**Issue:** NFR-003 originally said "using next-intl" but this project uses a custom I18nProvider at `src/ui/web/providers/I18n/index.tsx` with JSON files in `src/i18n/`. The codebase does NOT have next-intl installed.
**Fix Applied:** Updated NFR-003 to specify correct i18n approach: custom I18nProvider with JSON files. Added required translation keys listing.

### Gap 4: Missing Translation Keys

**Severity:** High
**Location:** src/i18n/en.json, src/i18n/he.json
**Issue:** Required translation keys for section titles and interaction labels are missing from the i18n files.
**Fix Applied:** Added explicit list of required keys to NFR-003 and acceptance criteria.

### Gap 5: RTL Chevron Direction Not Specified

**Severity:** Medium
**Location:** UI implementation
**Issue:** Original spec mentioned "RTL/LTR for chevron direction" but didn't specify how chevron rotation works in RTL mode.
**Fix Applied:** Added NFR-004 with explicit RTL chevron rotation requirements: LTR rotates to right, RTL rotates to left.

## Changes Made to Spec

- **Gap 1**: Added explicit note in FR-001 and NFR-001 that Accordion must be created first
- **Gap 2**: Removed Profile Picture from Details section, added to Out of Scope
- **Gap 3**: Fixed i18n approach - changed from "next-intl" to custom I18nProvider + JSON files
- **Gap 4**: Added specific translation keys required to NFR-003
- **Gap 5**: Added NFR-004 with detailed RTL chevron requirements

## No Gaps Found

(Not applicable - gaps were found and addressed)
