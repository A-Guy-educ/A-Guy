Resolved the CHANGELOG.md merge conflict from `git merge origin/dev` into `release/v0.25.9`.

The conflict was asymmetric: HEAD (PR #1660) added the standard Keep a Changelog header and `[Unreleased]` section with the #2011 entry including a QA status indicator (`· 🔄 QA (#2062)`), while origin/dev had only the bare #2011 entry without those additions. Took HEAD's version since it represents the proper changelog format for a release branch.

No conflict markers remain in the file.