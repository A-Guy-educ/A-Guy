# Stats Page Chart Fix — Issue #2450

## What was done

**Root cause**: The `/stats` page was missing chart visualizations entirely. The dashboard API returned aggregate data (timeSpent, dailyStreak, categoryProgress) but no time-series data for charts. The UI had no chart components.

**Fix implemented**:

1. **API change** (`src/app/api/stats/dashboard/route.ts`): Added `timeSeries` computation that groups progress records by day and sums `timeSpentSeconds`. Returns up to 30 days of daily study time.

2. **New component** (`src/app/(frontend)/stats/_components/StudyActivityChart.tsx`): CSS-based bar chart displaying daily study activity. Shows up to 14 days of bars with hover tooltips. Follows existing admin dashboard CSS bar pattern.

3. **UI integration** (`src/app/(frontend)/stats/_components/StatsDashboard.tsx`): Added `StudyActivityChart` to the grid between CategoryProgress and PracticedItems sections.

4. **Translations** (`src/i18n/en.json`, `src/i18n/he.json`): Added `studyActivity` and `total` keys.

5. **Test** (`tests/int/stats-dashboard-api.int.spec.ts`): Added test case verifying `timeSeries` field exists and has correct structure.

## Key files changed

- `src/app/(frontend)/stats/_components/StatsDashboard.tsx` — Added timeSeries to interface, imported and rendered StudyActivityChart
- `src/app/(frontend)/stats/_components/StudyActivityChart.tsx` — New CSS bar chart component
- `src/app/api/stats/dashboard/route.ts` — Added timeSeries computation and returned it in response
- `src/i18n/en.json` — Added studyActivity and total translation keys
- `src/i18n/he.json` — Added Hebrew translations
- `tests/int/stats-dashboard-api.int.spec.ts` — Added test for timeSeries field

## Follow-ups identified

- Add skeleton loading state for chart component
- Consider additional chart types (line chart, pie chart) for richer visualization
