---
name: fetch-requests-in-hooks-need-timeouts
title: Fetch Requests In Hooks Need Timeouts
type: lesson
source: task:1822
recorded_at: 2026-05-27T18:49:27Z
---

When a fetch request is made in a useEffect hook (like useStudyPlan's fetchPlan), it can hang indefinitely if the server doesn't respond. This causes isLoading to stay true forever, showing a loading spinner forever.

Fix: Use AbortController with a setTimeout to abort the request after a reasonable timeout (e.g., 15s).

**Why:** This bug (#1822) manifested as the /study-plan page showing 'Loading...' forever because the fetch to /api/study-plan had no timeout and no way to abort.

**Source task:** `1822`
