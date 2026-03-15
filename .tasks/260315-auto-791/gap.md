# Gap Analysis: Access Code Gate (Coupon Logic)

## Summary

- **Gaps Found**: 9
- **Spec Revised**: Yes

## Gaps Found

### Gap 1: Missing Access Type for Code Gate

**Severity:** Critical
**Location:** `src/server/constants/access-types.ts`, `src/infra/auth/access-types.ts`
**Issue:** The spec mentions an "Access Code Gate" toggle in Course/Lesson management, but there's no `accessCode` option in the current access types. The current access types are: `free`, `mandatory`, `gated`, and `inherit`.
**Fix Applied:** Added to spec: FR-001 must include adding a new access type option `accessCode` to the access types system, similar to existing types.

### Gap 2: No AccessCodes Collection

**Severity:** Critical
**Location:** `src/server/payload/collections/`
**Issue:** The spec requires admins to generate codes, set scope (lesson/course/all), and set redemption limits. This requires a new Payload collection that doesn't exist yet.
**Fix Applied:** Added to spec: FR-002 defines the need for a new `access-codes` collection with fields for code string, scope type, scope target, max redemptions, current redemption count, and active status.

### Gap 3: No User Field for Redeemed Codes

**Severity:** Critical
**Location:** `src/server/payload/collections/Users/index.ts`
**Issue:** The spec requires that "Once a code is successfully redeemed, the student is never asked for a code for that specific content again. Their access is tied to their account profile." This requires storing redeemed codes in the user profile.
**Fix Applied:** Added to spec: FR-003 requires adding a `redeemedAccessCodes` field (relationship or array) to the Users collection to track which content items the user has unlocked via codes.

### Gap 4: No Code Redemptions Tracking Collection

**Severity:** High
**Location:** `src/server/payload/collections/`
**Issue:** The spec requires admins to view "a list of every student who used the code, including Full Name, Email Address, Date of Redemption." This requires a separate collection to track each redemption event.
**Fix Applied:** Added to spec: FR-004 requires creating a `code-redemptions` collection to log each code redemption with user reference, code reference, timestamp, and content item.

### Gap 5: No API Endpoint for Code Validation/Redemption

**Severity:** Critical
**Location:** `src/server/payload/endpoints/`
**Issue:** Need an endpoint for students to validate and redeem codes. The spec says "If valid: The popup disappears, the content is revealed, and the student gains permanent access."
**Fix Applied:** Added to spec: FR-005 defines the need for a POST `/api/access-codes/redeem` endpoint that validates the code, increments redemption count, logs the redemption, and grants user access.

### Gap 6: No Frontend Code Entry Component

**Severity:** High
**Location:** `src/ui/web/auth/`, `src/ui/web/components/`
**Issue:** The spec describes a "small, clean popup" with a text field for code entry, blur effect on content, and validation messages. There's no existing component for this.
**Fix Applied:** Added to spec: FR-006 requires creating a new `AccessCodeGateModal` component (similar to `AuthGateModal`) that shows when content is flagged as `accessCode` restricted.

### Gap 7: No CSV Export for Admin Usage Reports

**Severity:** Medium
**Location:** Admin dashboard area
**Issue:** The spec requires "Export: Option to download this data as a CSV/Excel file for school reporting." There's no existing CSV export functionality found in the codebase.
**Fix Applied:** Added to spec: FR-007 requires implementing CSV export functionality in the access codes admin view, showing redemption history with student name, email, and date.

### Gap 8: Scope Definition Missing in Spec

**Severity:** Medium
**Location:** `spec.md` section 4.1
**Issue:** The spec mentions "Set whether a code unlocks one specific lesson, an entire course, or all site content" but doesn't clarify how the "all site content" option would work or if it's global vs. per-tenant.
**Fix Applied:** Added to spec: FR-002b clarifies scope options as enum: `lesson`, `course`, or `global` (all content).

### Gap 9: No i18n Translations for Code Gate Messages

**Severity:** Low
**Location:** `src/i18n/en.json`, `src/i18n/he.json`
**Issue:** The spec includes specific messages like "Access restricted. Please insert your school access code to unlock this content." and "Incorrect code. Please check with your teacher." These don't exist in the translation files.
**Fix Applied:** Added to spec: NFR-001 requires adding translation strings for the new code gate modal messages in both English and Hebrew.

---

## Changes Made to Spec

### Added FR-001: New Access Type Option
```markdown
### FR-001: Add Access Code Gate Access Type

**Priority**: MUST
**Description**: Add a new `accessCode` option to the access type system that can be set on courses and lessons. When content has this access type, it triggers the code gate UI instead of the existing gated/mandatory flows.

**Implementation Notes**:
- Add `accessCode` to `AccessType` and `LessonAccessType` in `@/infra/auth/access-types.ts`
- The frontend checks access type and shows code gate modal when `accessCode`
```

### Added FR-002: Access Codes Collection
```markdown
### FR-002: Access Codes Collection

**Priority**: MUST
**Description**: Create a new `access-codes` Payload collection for storing generated access codes.

**Fields**:
- `code`: text (unique) - The code string (e.g., "MACCABI-2024-FREE")
- `scopeType`: select - Scope of unlock: `lesson`, `course`, `global`
- `scopeTarget`: relationship - Points to specific lesson or course (conditional on scopeType)
- `maxRedemptions`: number (optional) - Maximum uses allowed
- `currentRedemptions`: number - Auto-incremented on use
- `isActive`: checkbox - Whether code is currently valid
- `expiresAt`: date (optional) - Expiration date
- `createdBy`: relationship to users - Admin who created the code
```

### Added FR-002b: Scope Type Clarification
```markdown
### FR-002b: Scope Type Options

**Priority**: MUST
**Description**: Define scope options for access codes:
- `lesson`: Unlocks one specific lesson
- `course`: Unlocks all lessons in a specific course  
- `global`: Unlocks all content on the platform
```

### Added FR-003: User Redeemed Codes Field
```markdown
### FR-003: User Redeemed Codes Field

**Priority**: MUST
**Description**: Add field to Users collection to track which content items the user has unlocked via codes.

**Fields**:
- `redeemedAccessCodes`: array of objects
  - `codeId`: relationship to access-codes
  - `contentId`: text (stores lesson/course ID that was unlocked)
  - `contentType`: select (`lesson` | `course`)
  - `redeemedAt`: date
```

### Added FR-004: Code Redemptions Tracking Collection
```markdown
### FR-004: Code Redemptions Collection

**Priority**: MUST
**Description**: Create `code-redemptions` collection for audit trail.

**Fields**:
- `code`: relationship to access-codes
- `user`: relationship to users
- `contentId`: text
- `contentType`: select
- `redeemedAt`: date
```

### Added FR-005: Code Redemption API Endpoint
```markdown
### FR-005: Code Redemption API

**Priority**: MUST
**Description**: Create API endpoint for validating and redeeming access codes.

**Endpoint**: `POST /api/access-codes/redeem`
**Request Body**: `{ code: string, contentId: string, contentType: string }`
**Response**: `{ success: boolean, message: string, unlockedContent?: {...} }`

**Validation Logic**:
1. Check user is authenticated
2. Find code in access-codes collection
3. Verify code is active and not expired
4. Check maxRedemptions not reached (if set)
5. Check user hasn't already redeemed this code for this content
6. Increment code's currentRedemptions
7. Add to user's redeemedAccessCodes
8. Create code-redemption record
9. Return success
```

### Added FR-006: Access Code Gate UI Component
```markdown
### FR-006: Access Code Gate Modal

**Priority**: MUST
**Description**: Create frontend component for code entry popup.

**Implementation**:
- New component: `src/ui/web/auth/AccessCodeGateModal.tsx`
- Uses existing Dialog component from design system
- Shows blur effect on content behind modal
- Input field for code entry
- Submit button "Unlock"
- Error state: "Incorrect code. Please check with your teacher."
- Success: Closes modal, reveals content, stores redemption
```

### Added FR-007: CSV Export for Admin
```markdown
### FR-007: Admin Usage Report Export

**Priority**: SHOULD
**Description**: Allow admins to export redemption data as CSV.

**Implementation**:
- Add export button to access code detail view
- Generate CSV with columns: Student Name, Email, Date Redeemed
- Use existing endpoint pattern for file download
```

### Added NFR-001: i18n Translations
```markdown
### NFR-001: Translation Strings

**Priority**: MUST
**Description**: Add Hebrew and English translations for code gate UI.

**Strings Required**:
- `accessCodeTitle`: "Access Restricted"
- `accessCodeDescription`: "Please insert your school access code to unlock this content."
- `accessCodePlaceholder`: "Enter code"
- `accessCodeUnlock`: "Unlock"
- `accessCodeError`: "Incorrect code. Please check with your teacher."
- `accessCodeSuccess`: "Content unlocked!"
```
