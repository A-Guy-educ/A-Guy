# CI baseline check

This branch adds nothing but this file. It exists to verify that dev's CI
coverage failure reproduces on a fresh branch — i.e. that the failure is
independent of any feature changes elsewhere.

If this branch fails `Integration Tests` with the same `50/45` coverage error
dev is hitting, the root cause is in dev itself and needs a dev-level fix.
