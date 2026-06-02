---
name: afterread-hook-siblingdata-vs-value
title: Afterread Hook Siblingdata Vs Value
type: decision
source: task:2220
recorded_at: 2026-06-01T11:29:50Z
---

The afterReadDiscountValue hook receives both `value` (the raw stored field value) and `siblingData` (the full document snapshot). For the shekel→agorot conversion to work, we need to check siblingData.discountType to know whether to divide. This is because Payload's afterRead for a field receives the sibling data, not the transformed value.

**Why:** The value param is the raw stored value; the siblingData is needed to determine the discount type and decide whether conversion is needed. Without siblingData, we'd have no way to know the discountType at afterRead time.

**Source task:** `2220`
