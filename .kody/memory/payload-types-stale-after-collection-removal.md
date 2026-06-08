---
name: payload-types-stale-after-collection-removal
title: Payload Types Stale After Collection Removal
type: lesson
source: task:1574
recorded_at: 2026-06-07T16:31:31Z
---

When a collection is removed from payload.config.ts, the payload-types.ts must be regenerated with `pnpm generate:types`. The check-types-drift.ts script will fail if the committed types don't match what the current config generates.

**Why:** The payload-types.ts contained references to 'payload-mcp-api-keys' collection that no longer existed in the config. This caused CI to fail with a types drift error.

**Source task:** `1574`
