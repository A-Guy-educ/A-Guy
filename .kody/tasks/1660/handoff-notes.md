Resolved the CHANGELOG.md merge conflict from `git merge origin/dev` into `release/v0.25.9`.

The conflict was asymmetric: HEAD had all [Unreleased] entries with #2011 marked as 🔄 QA (#2062), while origin/dev had #2011 with a newer QA marker ⚠️ QA 2026-05-25 (#2079). Resolution: kept all HEAD entries but updated #2011's QA marker to the newer value from dev.

No conflict markers remain in the file.