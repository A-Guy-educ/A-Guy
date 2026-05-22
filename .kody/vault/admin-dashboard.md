---
title: Admin Dashboard
type: component
updated: 2026-05-04
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1376
  - https://github.com/A-Guy-educ/A-Guy/pull/1374
---

## Overview

The admin dashboard (`/admin`) displays conversion tracking metrics, user statistics, and content counts. Key components live in `src/ui/admin/ConversionTracking/`.

## User Metrics Widget — Redesign (PR #1376)

The `UserMetricsWidget` component was refactored to replace the old pill-filtered registration card with a static `RegisteredUsersCard` sub-component.

### Before (pill filter pattern)
- Filter pills: Yesterday / This Week / This Month / Total
- Single number display that changed on pill selection
- Inline trend badge for the selected period

### After (static breakdown pattern)
- **No filter pills** — always shows total users prominently (42px bold number)
- Three static breakdown rows: Yesterday, Last Week, Last Month
- Trend badges shown for Last Week and Last Month comparisons
- Blue decorative strip at card top (4px, `ACCENT.blue`)
- Inner detail box with darker background (`var(--theme-elevation-100)`)

New style exports added in `styles.ts`: `registeredCard*` series.

New string keys added in `strings.ts`: `registeredLastWeek`, `registeredLastMonth`.

### Testing
- E2E tests: `tests/e2e/admin-dashboard-registered-card.e2e.spec.ts` — verifies card renders, rows visible, trend badge colors, decorative strip, detail box.
- Integration test: `tests/int/admin-dashboard-metrics.int.spec.ts` — verifies the API response shape the widget depends on.

## Payload Config Components

Registered in `payload.config.ts`:

```ts
beforeDashboard: ['@/ui/admin/ConversionTracking/DashboardWidgets', '@/ui/admin/VersionInfo'],
beforeNavLinks: ['@/ui/admin/PdfConversion/SidebarLink'],
```

Admin Chat was removed from both slots (see [admin-chat](./admin-chat.md)).

## Related

- [admin-chat](./admin-chat.md)
- [dashboard-metrics-api](./dashboard-metrics-api.md)
- [kody-engine](./kody-engine.md)
