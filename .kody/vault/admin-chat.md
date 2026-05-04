---
title: Admin Chat
type: component
updated: 2026-05-04
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1381
---

## Overview

Admin Chat provides AI-powered content querying within the Payload admin panel. It was previously surfaced as a large dashboard widget and sidebar nav item; it is now a compact link in the dashboard header.

## Current Placement

The chat link lives in `DashboardHeader` (`src/ui/admin/ConversionTracking/DashboardHeader.tsx`) as a small inline `<Link>` with text **"Chat with AI"**, positioned next to the dashboard title.

```tsx
<Link href="/admin/chat" style={{ fontSize: 13, fontWeight: 500, color: 'var(--theme-elevation-600)' }}>
  Chat with AI
</Link>
```

## Removed Components (PR #1381)

The following were removed from `payload.config.ts` and deleted:

| File | Was registered as |
|---|---|
| `src/ui/admin/AdminChat/DashboardWidget/index.tsx` | `beforeDashboard` component |
| `src/ui/admin/AdminChat/SidebarLink/index.tsx` | `beforeNavLinks` component |

The `importMap.js` auto-generated entries for these components are also removed automatically.

## Translation Keys

The `admin.chatLink` key exists in both `src/i18n/en.json` and `src/i18n/he.json` (added in PR #1381) but is not currently used — the link text is hardcoded as "Chat with AI". The key is preserved for future i18n if the link text changes.

## Related

- [admin-dashboard](./admin-dashboard.md)
- [payload-config](../architecture/payload-config.md)
