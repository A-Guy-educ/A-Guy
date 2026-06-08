Resolved merge conflict in `src/ui/admin/VersionInfo/index.tsx` by taking the origin/dev side.

The conflict was between:
- HEAD (PR branch): dynamic fetch from `/api/version` at runtime, falling back to 'dev'
- origin/dev: static read from `package.json` at build time via require

origin/dev wins because the PR's stated goal is to fix "unversioned vdev label" — the dynamic fetch approach fails in production when the API endpoint is unavailable, causing exactly the bug being fixed. The static approach always shows the real version from package.json.

The `'use client'` directive was removed since the origin/dev version has no client-side state or effects.
