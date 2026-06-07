Task 1547: CI failure on PR #1547.

Failure: Docker Hub network timeout in Build job. Error: `Error response from daemon: Get "https://registry-1.docker.io/v2/": net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers)`. The `docker/setup-buildx-action` failed when trying to pull `moby/buildkit:buildx-stable-1`.

Root cause: Environmental — transient network issue reaching Docker Hub from the GitHub Actions runner.

Resolution: No code change. This was a transient failure. The subsequent CI run (27093380581) passed all jobs including Build. The PR's code changes are fine.

Fast Gate passed in the failing run. Only Build job failed.
