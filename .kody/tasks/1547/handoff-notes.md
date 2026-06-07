Task 1547 CI fix investigation.

Failing run 26814534558 (2026-06-02) failed during the Integration Tests step due to Docker Hub network timeouts — `docker pull mongo:7` failed with "context deadline exceeded" and "net/http: request canceled while waiting for connection".

Root cause: transient Docker Hub network connectivity issue, not a code defect.

Resolution: The PR #1547 already contains the fix — the CI workflow was updated to use `docker pull mongo:7` with a 5-retry loop and 10s backoff before starting the MongoDB service container. This handles transient Docker Hub failures gracefully.

Latest CI runs on this branch (27103745499 at 2026-06-07T20:21:46Z and earlier) are all success. No code changes needed — the failure was environmental and the retry logic in the PR already addresses it.