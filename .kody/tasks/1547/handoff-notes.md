## CI Docker Buildx Timeout Fix

**Problem:** CI was failing with `Client.Timeout exceeded while awaiting headers` when `docker/setup-buildx-action@v3` tried to boot a builder by pulling `moby/buildkit:buildx-stable-1` from Docker Hub.

**Root cause:** The `docker/setup-buildx-action@v3` step was trying to pull the buildkit image even though none of the CI jobs actually build Docker images - they only use `docker pull` and `docker run` for MongoDB. Buildx is only needed for `docker buildx build` commands.

**Fix applied to `.github/workflows/ci.yml`:**

Removed the `docker/setup-buildx-action@v3` step from all 6 jobs that had it:
- `integration-tests`
- `build`
- `e2e-gate`
- `e2e-system-tests`
- `qa-scenarios-core`
- `qa-scenarios-full`

**Why this works:** The jobs don't need Buildx since they don't build Docker images - they only pull and run MongoDB containers. Removing the unnecessary step eliminates the network call to pull buildkit from Docker Hub.
