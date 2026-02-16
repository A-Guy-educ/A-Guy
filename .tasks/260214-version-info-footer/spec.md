# Spec: 260214-version-info-footer

## Overview

Add a VersionInfo component to the admin panel footer that displays the application version and build date in a readable format, aligned with existing admin styling.

## Requirements

### FR-001: Display version number

**Priority**: MUST
**Description**: Show the current application version (sourced from package.json or an environment variable) within the admin footer.

### FR-002: Display build date

**Priority**: MUST
**Description**: Show the build date (when the app was built) within the admin footer.

### FR-003: Admin footer placement

**Priority**: MUST
**Description**: The VersionInfo component must render in the admin panel footer area and be visible on admin pages.

### FR-004: Readable formatting

**Priority**: SHOULD
**Description**: Format the version and build date in a compact, readable string (e.g., “v1.2.3 • Built 2026-02-14”).

### FR-005: Match admin styling

**Priority**: MUST
**Description**: Styling must align with existing admin panel design language and not introduce new visual themes.

### NFR-001: Safe data sourcing

**Priority**: MUST
**Description**: Version/build values must be read-only and derived from build-time or configuration sources (no runtime mutation).

### NFR-002: Minimal performance impact

**Priority**: SHOULD
**Description**: The component should be lightweight and not introduce noticeable render overhead in the admin UI.

## Acceptance Criteria

- [ ] Version number is displayed in the admin footer.
- [ ] Build date is displayed in the admin footer.
- [ ] Component is visible in the admin panel footer across admin pages.
- [ ] Presentation matches existing admin styling and typography.

## Guardrails

- Do not alter unrelated admin header or navigation behavior.
- Do not change existing footer functionality outside adding VersionInfo.
- Do not introduce new global styles that affect non-admin UI.
- Use existing admin UI patterns and structure for placement.

## Out of Scope

- Displaying commit hashes, build IDs, or environment names.
- Adding runtime API calls to fetch version/build metadata.
- Modifying frontend (non-admin) footer components.
