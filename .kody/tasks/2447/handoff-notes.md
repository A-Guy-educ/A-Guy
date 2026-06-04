## Fix: Stats page chart area entirely absent

### What was done

Added a bar chart visualization (StudyActivityChart) to the `/stats` page that displays daily study time over the selected timeframe.

### Root cause
The stats page API returned data correctly, but the UI had no chart component to visualize the daily time-series. The ActivityTimeline shows individual events, but there's no aggregate daily time-spent visualization.

### Files changed

- **src/app/api/stats/dashboard/route.ts** — Added `dailyActivity` computation: groups progress records by date, sums `timeSpentSeconds` per day, returns sorted array `{date, timeSpentSeconds}[]`.

- **src/app/(frontend)/stats/_components/StatsDashboard.tsx** — Added `dailyActivity` to `DashboardData` interface; imports and renders `StudyActivityChart`.

- **src/app/(frontend)/stats/_components/StudyActivityChart.tsx** (new) — Client component using `recharts` `BarChart`. Renders empty state when no data; gradient-opacity bars when data exists; custom tooltip; uses design system tokens for colors.

- **src/i18n/en.json** and **src/i18n/he.json** — Added `studyActivity` translation key.

- **tests/e2e/stats-page-chart.e2e.spec.ts** (new) — E2E test that checks for `svg.recharts-surface`, `.recharts-wrapper`, `.recharts-bar`, `.recharts-line` on the stats page.

- **package.json** — Added `recharts@3.8.1` dependency.

### Verification
- TypeScript (`tsc --noEmit`) passes with no errors.
- ESLint passes (only a pre-existing unrelated warning in LatexDocumentViewer).
- Prettier formatted all changed files.
- `pnpm verify` returned `ok: true` on attempt 1.
