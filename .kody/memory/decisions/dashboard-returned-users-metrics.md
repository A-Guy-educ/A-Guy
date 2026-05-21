---
title: Dashboard Returned Users Metrics
type: decision
updated: 2026-05-13
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1590
---

The dashboard metrics API (`/api/admin/dashboard-metrics`) was extended with returned-user analytics to give admins insight into user retention.

## returnCount Field

A `returnCount: number` field was added to the `UserStats` Payload collection (min 0, default 0). It represents the number of times a user returned after their first active day. Values > 2 indicate "returned multiple times."

## firstActiveDate Proxy

`firstActiveDate` does not exist as a schema field. The `createdAt` timestamp (Payload's built-in auto-managed field) is used as a reliable proxy — it indicates when the user-stats document was first created, which is the user's first active day.

## Returned User Definitions

- **Returned Once+**: `createdAt < lastActiveDate` — user came back at least once after their first active day
- **Returned Multiple Times**: `returnCount > 2` — user returned more than twice

Both return count and percentage are reported. Percentages are capped at [0, 100] using `Math.min(100, Math.max(0, ...))`.

## Guest → Registered Conversion

Both count and percentage are reported. Percentage = `(claimedGuests / totalGuests) * 100`, capped at 100%.

## Related

- [UserStats collection](../architecture/user-stats-collection.md)
