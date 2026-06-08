Resolved the single conflicted file `.kody/reports/duty-review.md` by merging HEAD and origin/dev.

The file is a duty-review status table. Both sides modified the same rows with different staff assignments and cadences (HEAD = Cycle 7/ceo/platform cadence 7d; origin/dev = Cycle 14/cto/qa cadence 1h). Took origin/dev's Cycle 14 header and staff values for all overlapping duties, and preserved all unique rows from both sides (e.g., origin/dev's 1h cadence for qa-verify/qa vs HEAD's ceo-platform 7d rows).

No functional code files were touched.
