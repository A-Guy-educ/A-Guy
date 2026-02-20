# Task: 260214-version-info-footer

## PRD (Product Requirements Document)

**Feature:** Add a "Version Info" footer component to the admin panel

**Requirements:**

- Display the app version number (from `package.json` version property)
- Display the build date (from `BUILD_DATE` env var or current date)
- Position: Admin dashboard (beforeDashboard slot)
- Format: "v0.9.0 • Built 2026-02-14"
- Style: Match existing admin panel styling

## Metadata

- **ID:** 260214-version-info-footer
- **Type:** feat
- **Status:** ✅ complete
- **Date:** 2026-02-14
- **Pipeline:** spec → plan → build → verify

## Files Created

- `src/ui/admin/VersionInfo/index.tsx` - VersionInfo component
- `.tasks/.../spec.md` - Spec output
- `.tasks/.../plan.md` - Plan output
- `.tasks/.../build.md` - Build output
- `.tasks/.../verify.md` - Verify output

## Environment Variables Needed

```bash
BUILD_DATE=2026-02-14
```

_Note: Version is read automatically from package.json_
