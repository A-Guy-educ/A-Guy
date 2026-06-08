---
title: Dashboard Metrics Architecture
type: architecture
updated: 2026-05-12
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1590
---

Admin dashboard metrics are served from `src/app/api/admin/dashboard-metrics/route.ts`. Data is queried from three Payload collections: `users`, `user-stats`, and `courses`.

## User Activity Tracking

The `UserStats` collection stores per-user activity records with a `lastActiveDate` field. The `createdAt` timestamp on `UserStats` documents serves as the authoritative proxy for first-active date — the `firstActiveDate` field does not exist in the schema.

## New Metric Fields (PR #1590)

PR #1590 expanded the metrics with time-window breakdowns:

- **Active users**: today, yesterday, last-7-day window, last-30-day window
- **Guest sessions**: today, last-7-day window, last-30-day window
- **Guest-to-registered conversion**: absolute count + percentage
- **Returning users**: single-return count + percentage, multi-return count + percentage

## Related

- [Lesson Duplication Service](lesson-duplication.md) — separate service with its own metrics
- `src/app/api/admin/dashboard-metrics/route.ts` — implementation
- `src/server/payload/collections/UserStats.ts` — schema
