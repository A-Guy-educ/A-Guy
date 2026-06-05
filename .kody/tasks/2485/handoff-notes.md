## Issue #2485 — Course Enrollments widget shows counts only, no progress bars

### Root Cause
When all enrollment counts are 0, `pct = (0 / maxCount) * 100 = 0` → bar inner div gets `width: 0%` and is invisible. The DOM element exists but visually disappears. The existing E2E test created a `progressBars` locator but never asserted on it, so it passed despite the bug.

### Fix
**Widget** (`src/ui/admin/CourseEnrollmentsWidget/index.tsx:113`):
```tsx
// Before
const pct = (course.count / maxCount) * 100

// After
const pct = Math.max((course.count / maxCount) * 100, 5)
```
Minimum 5% width ensures bars remain visible even when count is 0.

**Test** (`tests/e2e/admin-dashboard-course-enrollments-widget.e2e.spec.ts`):
The existing test 'widget shows progress bars for courses' created locators but never asserted on them. Rewrote to:
- Assert the bar containers exist and are visible
- Assert inner bars have non-zero width percentage

### Files Changed
- `src/ui/admin/CourseEnrollmentsWidget/index.tsx` — minimum bar width
- `tests/e2e/admin-dashboard-course-enrollments-widget.e2e.spec.ts` — test assertions

### Known Gap
E2E tests could not be executed in this session (no Docker/MongoDB). TypeScript and lint pass. The fix is logically correct based on code inspection.

### Follow-up
EngagementWidget (`src/ui/admin/ConversionTracking/EngagementWidget.tsx`) has the identical pattern without a minimum width — same issue applies there.
