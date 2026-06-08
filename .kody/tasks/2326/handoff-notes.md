## Merge conflict resolution for #2326

**Conflicted file:** `src/ui/admin/VersionInfo/index.tsx`

**Resolution:** Took the `origin/dev` side of the conflict.

**Why:** The PR side used `import ... ?raw` (Vite raw import syntax) without any env override, falling back only to `'dev'`. The `origin/dev` side uses `require()` with TypeScript typing and adds `NEXT_PUBLIC_APP_VERSION` env override — which aligns with the PR's goal of fixing the "vdev placeholder" issue. The env override is strictly better for CI/CD use cases where version is injected at deploy time.

No other files were conflicted. No generated files were involved.
