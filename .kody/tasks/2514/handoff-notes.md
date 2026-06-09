Resolved 2 conflicts in `.kody/reports/` — both automated rolling reports:

- **duty-review.md**: HEAD had Cycle 12 data, origin/dev had Cycle 16 (more current). Took origin/dev.
- **health-check.md**: HEAD had 4 failed items including a stale #1563 entry; origin/dev had 2 failed items with updated hours. Took origin/dev.

Both files are rolling automated reports — origin/dev always wins since it reflects the latest automated refresh.
