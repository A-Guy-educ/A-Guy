---
name: coupon-fixed-discount-unit-conversion
title: Coupon Fixed Discount Unit Conversion
type: decision
source: task:2220
recorded_at: 2026-06-01T11:29:50Z
---

When converting fixed coupon discountValue between shekels (admin input) and agorot (storage), use a threshold of 10000 to detect already-converted values. Values < 10000 are shekels entered by admin → multiply by 100. Values ≥ 10000 are already in agorot → leave unchanged. This makes the conversion idempotent: re-saving a coupon in the admin UI doesn't double-convert. The same threshold approach applies to the afterRead division (agorot→shekels only when stored value looks like agorot, i.e., ≥ 10000).

**Why:** Without this threshold, every save would multiply by 100 again, corrupting already-corrected data. The issue's 'round-trip' requirement (stored 3000 → shows 30 → save → 3000 again) requires idempotency.

**Source task:** `2220`
