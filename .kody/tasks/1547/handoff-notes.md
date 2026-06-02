## CI MongoDB Docker Hub Timeout Fix

**Problem:** `docker pull mongo:7` was timing out with `context deadline exceeded` errors reaching Docker Hub registry. This affected the Integration Tests job (and other jobs using MongoDB services).

**Root cause:** Docker Hub connectivity issues from GitHub Actions runners, not a code problem.

**Fix applied to `.github/workflows/ci.yml`:**

Replaced all 5 `services: mongodb:` blocks with explicit Docker steps:

1. `docker/setup-buildx-action@v3` — sets up Buildx for better Docker handling
2. Pre-pull step with 5 retries and 10s backoff between attempts
3. `docker run -d --name mongodb -p 27017:27017 mongo:7` — starts container explicitly
4. Wait-for-ready loop using `docker exec mongodb mongosh --eval 'db.runCommand({ ping: 1 })'`

**Jobs updated:**
- `integration-tests`
- `build`
- `e2e-gate`
- `e2e-system-tests`
- `qa-scenarios-core`
- `qa-scenarios-full`

**Why this works:** The pre-pull with retries handles transient Docker Hub network failures. Buildx can use Docker layer caching to speed up subsequent pulls. The explicit `docker run` bypasses GitHub Actions' service container pull mechanism which had no retry logic.
