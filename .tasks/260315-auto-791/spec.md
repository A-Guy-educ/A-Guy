# Access Code Gate (Coupon Logic) - Specification

## Overview

To provide specific institutions (e.g., schools) with free access to paid or restricted courses/lessons via a "Coupon Code" mechanism. This allows the system to grant access without traditional payment while enabling the administration to track exactly which students (by name and email) are utilizing each school's allocation.

## Requirements

### FR-001: Add Access Code Gate Access Type

**Priority**: MUST
**Description**: Add a new `accessCode` option to the access type system that can be set on courses and lessons. When content has this access type, it triggers the code gate UI instead of the existing gated/mandatory flows.

**Implementation Notes**:
- Add `accessCode` to `AccessType` and `LessonAccessType` in `@/infra/auth/access-types.ts`
- The frontend checks access type and shows code gate modal when `accessCode`

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

### FR-003: User Redeemed Codes Field

**Priority**: MUST
**Description**: Add field to Users collection to track which content items the user has unlocked via codes.

**Fields**:
- `redeemedAccessCodes`: array of objects
  - `codeId`: relationship to access-codes
  - `contentId`: text (stores lesson/course ID that was unlocked)
  - `contentType`: select (`lesson` | `course`)
  - `redeemedAt`: date

### FR-004: Code Redemptions Collection

**Priority**: MUST
**Description**: Create `code-redemptions` collection for audit trail.

**Fields**:
- `code`: relationship to access-codes
- `user`: relationship to users
- `contentId`: text
- `contentType`: select
- `redeemedAt`: date

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

### FR-006: Access Code Gate Modal Component

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

### FR-007: Admin Usage Report Export

**Priority**: SHOULD
**Description**: Allow admins to export redemption data as CSV.

**Implementation**:
- Add export button to access code detail view
- Generate CSV with columns: Student Name, Email, Date Redeemed
- Use existing endpoint pattern for file download

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

### NFR-002: Access Control Security

**Priority**: MUST
**Description**: Ensure code redemption is secure and cannot be exploited.

**Requirements**:
- Code validation must happen server-side
- Rate limiting on redemption endpoint to prevent brute force
- Admin-only access to create/modify codes
- Users can only read their own redemption history

## Acceptance Criteria

- [ ] A student from "School A" can log in, enter a code, and immediately see their lesson
- [ ] The Admin can go to the dashboard and see that "Student Name (Email)" redeemed the "School A" code at 10:00 AM
- [ ] Content that is not flagged remains open and accessible as usual
- [ ] Invalid codes show error message and do not grant access
- [ ] Students who redeemed a code are never asked for the code again for that content
- [ ] Admins can create codes with lesson, course, or global scope
- [ ] Admins can set optional max redemption limits
- [ ] Admins can export redemption data as CSV

## Guardrails

- **Existing Access Types**: Must not break existing `free`, `mandatory`, `gated` access types
- **User Data**: Must not expose user email/name to unauthorized parties
- **Code Security**: Must prevent brute force attacks on code redemption
- **Performance**: Must not add significant latency to content loading

## Out of Scope

- Integration with payment systems (this is a free access mechanism, not paid)
- Multi-tenant code management (single tenant assumed)
- Time-based access (codes are valid until manually deactivated or max redemptions reached)
- Student self-service code generation
