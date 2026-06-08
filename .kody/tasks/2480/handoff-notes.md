Resolved merge conflicts in two generated report files by taking the origin/dev version (newer cycle/higher hour counts).

- .kody/reports/duty-review.md: HEAD (Cycle 9) vs origin/dev (Cycle 11) — took origin/dev as it reflects the more recent automated state
- .kody/reports/health-check.md: HEAD (older hour counts, "Running"/"Failed" headers) vs origin/dev (newer hour counts, "kody:running"/"kody:failed" headers) — took origin/dev

Both are auto-generated reports; the dev branch carries the fresher snapshot. No application code files were touched.
