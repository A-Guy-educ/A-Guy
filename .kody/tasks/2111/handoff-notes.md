# Task 2111 — Improve admin Coupons list and detail views

## What was implemented

### Backend: Virtual computed fields via afterRead hooks
- `src/server/payload/hooks/coupons/computeListDisplayFields-hook.ts` — three pure functions:
  - `computeCouponStatus(doc)` → 'Active' | 'Expired' | 'Exhausted' | 'Inactive' | 'Scheduled'
  - `computeUsageDisplay(doc)` → '12 / 100' or '12 / ∞'
  - `computeExpiresDisplay(doc)` → 'in 3 days', 'Expired 5 days ago', or 'Never expires'
- These are registered as `afterRead` hooks on three new `text` virtual fields in `Coupons.ts`

### Collection config changes (Coupons.ts)
- `defaultColumns` updated to include `status`, `usageDisplay`, `expiresDisplay` instead of raw `usesCount`, `maxUses`, `validUntil`
- Three new virtual fields added with `afterRead` hooks and custom `Cell` components
- A `usageProgress` UI field added for the detail view (rendered via `UsageProgressField`)

### UI Cell components
- `src/ui/admin/Coupons/Cells/StatusCell/` — color-coded badge (success/destructive/warning/muted/primary)
- `src/ui/admin/Coupons/Cells/UsageCell/` — monospace "used / max" display
- `src/ui/admin/Coupons/Cells/ExpiresCell/` — colored relative expiration text

### Detail view: Usage progress bar
- `src/ui/admin/Coupons/UsageProgressField/` — UI field showing progress bar when `maxUses > 0`
- `src/ui/admin/Coupons/EditView/` — custom edit view wrapper (not yet wired up — see followups)

### Translations (strings.ts)
- Added `statusActive/Expired/Exhausted/Inactive/Scheduled`, `usageLabel`, `expiresLabel`, `expiresNever`, `usageProgress`, `usageRemaining`, `usageExhausted` to both EN and HE

### Tests
- 11 new test cases in `tests/int/coupons.int.spec.ts` covering all computed field scenarios

## Followups
1. **Wire CouponEditView into collection config** — the EditView component exists but isn't registered in `admin.components.views.edit` in Coupons.ts
2. **Test UsageProgressField in sidebar context** — `useFormFields()` may behave differently in sidebar UI fields vs main form

## Key design decisions
- Used CSS variable tokens (`hsl(var(--success)/0.15)`) for badge backgrounds, matching the existing `DiffBadge` pattern
- Used `useFormFields` in UsageProgressField (not `useDocumentData`) for proper form context integration
- afterRead hooks cast to `any` due to Payload type mismatch between `CollectionAfterReadHook` and `FieldHook`
