Task 1547 merge conflict resolution.

Conflict in .kody/reports/duty-review.md — an asymmetric table conflict where HEAD (PR branch) had the full populated table with Staff/cadence values, while origin/dev had a sparser version with a duty-review row (which belongs in the report footer, not as a data row).

Resolution: Took HEAD version in full. The HEAD table is more complete and correct — origin/dev's version had a spurious duty-review entry that would have duplicated the report's own header section. No code changes beyond removing conflict markers.
