# Fix: Admin Dashboard Widgets Not Rendered on Page Load (#2462)

## What was fixed

Fixed a crash bug in `CourseEnrollmentsWidget` and `TopProductsWidget` that caused widgets to not render when the API returned `data.engagement` or `data.revenueMetrics` objects that were truthy but missing their nested `courseEnrollments` or `topProducts` array properties.

## Root cause

The widgets checked `!data?.engagement` before accessing nested properties, but this only guards against falsy `engagement` objects. If `engagement` was truthy (e.g., `{}`) but `courseEnrollments` was undefined, calling `.map()` on `undefined` would crash the entire component tree, causing all dashboard widgets to disappear.

## Files changed

1. `src/ui/admin/CourseEnrollmentsWidget/index.tsx` - Added guard `|| !data.engagement.courseEnrollments` to the error check
2. `src/ui/admin/TopProductsWidget/index.tsx` - Added guard `|| !data.revenueMetrics.topProducts` to the error check

## Verification

- Quality gates passed (typecheck, lint)
- Existing E2E tests cover basic widget rendering