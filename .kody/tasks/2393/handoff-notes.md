# Task 2393: Mark derived coupon fields as read-only in admin config

## What was done

Added `admin: { readOnly: true }` to four virtual derived fields in `src/server/payload/collections/Coupons.ts`:
- `status` (line 227)
- `usageDisplay` (line 240)
- `expiresDisplay` (line 254)
- `discountDisplay` (line 269)

These fields are computed via `afterRead` hooks and should not be manually edited. The `readOnly: true` flag makes them render as plain text labels in the Payload admin UI instead of editable `<input>` elements, preventing admins from accidentally submitting arbitrary values.

## Test added

New integration test in `tests/int/coupons.int.spec.ts` ("Derived fields are read-only in admin" describe block) verifies that submitting arbitrary values for derived fields via update does not result in those values being persisted (they must still show computed values after read).

## Why the fix works

`admin: { readOnly: true }` in Payload CMS makes a field non-editable in the admin UI. The form will not include these fields in submitted data when `readOnly: true` is set, preventing the admin UI from sending arbitrary values for these derived fields.

## No other files changed
